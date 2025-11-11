import * as cheerio from 'cheerio';

import { processIngredient } from '../enrichment/ingredientParser.js';
import { processInstructions } from '../enrichment/instructionParser.js';
import { RecipeIngredient, Recipe, } from '../types.js';
import { RecipeValidator } from '../validation/recipeValidator.js';
import { ComprehensiveEnrichment } from '../enrichment/comprehensiveEnrichment.js';
import { getNutritionEnrichment } from '../enrichment/nutritionEnrichment.js';
import { Nutrition } from '../types.js';
import { ParsedRecipeData } from '../shared/types.js';

/*
 * The strict, raw, unstructured data shape that the scraper MUST return.
 * All optional string fields must be `string | undefined`, NOT `string | null`.
 */
export interface RawScrapedRecipe {
  title: string;
  description?: string;
  image_url?: string;
  servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  ingredients: string[];
  instructions: string[];
  author?: string;
  source_url: string;
  effort_level?: string;
  cuisines?: string[];
  meal_types?: string[];
  tags?: string[];
  created_by?: string;
}



function normalizeStrings(items: any[], $: cheerio.CheerioAPI): string[] {
    return items.map(item => {
        let text = '';
        if (typeof item === 'string') text = item;
        else if (item.type === 'tag' && item.name === 'li') text = $(item).text();
        else if (typeof item === 'object' && item.text) text = item.text;
        return text.replace(/\s+/g, ' ').trim();
    }).filter(Boolean); // Filter out any empty strings
}

/*
 * Estimate prep time from instruction text analysis
 */
function estimatePrepTimeFromInstructions(instructions: string[]): number {
    let prepTime = 0;
    
    instructions.forEach(instruction => {
        const text = instruction.toLowerCase();
        // Count prep-related activities
        if (text.includes('prep') || text.includes('prepare')) prepTime += 5;
        if (text.includes('chop') || text.includes('dice') || text.includes('mince')) prepTime += 3;
        if (text.includes('mix') || text.includes('combine') || text.includes('stir')) prepTime += 2;
        if (text.includes('wash') || text.includes('rinse') || text.includes('clean')) prepTime += 2;
        if (text.includes('peel') || text.includes('trim')) prepTime += 3;
        if (text.includes('slice') || text.includes('cut')) prepTime += 3;
        if (text.includes('measure') || text.includes('weigh')) prepTime += 1;
    });
    
    return Math.max(prepTime, 10); // Minimum 10 minutes prep time
}

/*
 * Estimate cook time from instruction text analysis
 */
function estimateCookTimeFromInstructions(instructions: string[]): number {
    let cookTime = 0;
    let hasTimingInfo = false;
    
    instructions.forEach(instruction => {
        const text = instruction.toLowerCase();
        
        // Look for explicit timing information first
        const timeMatches = text.match(/(\d+)\s*(minute|min|hour|hr)s?/g);
        if (timeMatches) {
            timeMatches.forEach(match => {
                const numMatch = match.match(/\d+/);
                if (numMatch) {
                    const time = parseInt(numMatch[0]);
                    if (match.includes('hour') || match.includes('hr')) {
                        cookTime += time * 60; // Convert hours to minutes
                    } else {
                        cookTime += time;
                    }
                    hasTimingInfo = true;
                }
            });
        }
        
        // If no explicit timing, estimate based on cooking methods
        if (!hasTimingInfo) {
            if (text.includes('bake') || text.includes('roast')) cookTime += 30;
            else if (text.includes('simmer') || text.includes('boil')) cookTime += 15;
            else if (text.includes('fry') || text.includes('saute') || text.includes('sear')) cookTime += 8;
            else if (text.includes('grill') || text.includes('broil')) cookTime += 10;
            else if (text.includes('steam')) cookTime += 12;
            else if (text.includes('microwave')) cookTime += 3;
        }
    });
    
    return Math.max(cookTime, 5); // Minimum 5 minutes cook time
}

/*
 * Parse raw scraped recipe data using the parsing specification with comprehensive validation
 * @param rawRecipe - Raw scraped recipe data
 * @returns Validated and complete parsed recipe data
 */
async function parseRecipeData(rawRecipe: RawScrapedRecipe): Promise<ParsedRecipeData> {
    console.log(`🔄 Parsing and validating recipe: "${rawRecipe.title}"`);
    
    try {
        // Use comprehensive enrichment for complete recipe processing including:
        // - Enhanced ingredient parsing with nutrition data
        // - Health score calculation
        // - Embedding generation
        // - Meal type derivation from tags
        // - Cooking method derivation from instructions
        // - Dietary restriction analysis
        console.log(`🚀 Starting comprehensive enrichment pipeline...`);
        
        const enrichedRecipe = await ComprehensiveEnrichment.enrichRecipe(rawRecipe);
        
        // Add nutrition data if not already present
        if (!enrichedRecipe.nutrition) {
            console.log(`🥗 Fetching nutrition data for ingredients...`);
            const nutritionResult = await getNutritionEnrichment({
                ingredients: rawRecipe.ingredients,
                servings: typeof rawRecipe.servings === 'number' ? rawRecipe.servings : 4
            });
            
            if (nutritionResult.nutrition) {
                enrichedRecipe.nutrition = nutritionResult.nutrition;
                console.log(`✅ Nutrition data populated: ${enrichedRecipe.nutrition.calories} calories per serving`);
                
                // Calculate health score based on nutrition data
                const healthScore = calculateHealthScore(enrichedRecipe.nutrition);
                (enrichedRecipe as any).health_score = healthScore;
                console.log(`✅ Health score calculated: ${healthScore}/100`);
            }
        }
        
        // Generate embeddings if not present
        if (!enrichedRecipe.embedding) {
            try {
                console.log(`🔮 Generating recipe embeddings...`);
                const embedding = await generateRecipeEmbedding(
                    `${enrichedRecipe.title} ${enrichedRecipe.description || ''} ${enrichedRecipe.ingredients.map(i => i.text).join(' ')}`
                );
                enrichedRecipe.embedding = embedding;
                console.log(`✅ Recipe embeddings generated successfully`);
            } catch (embeddingError) {
                console.warn(`⚠️ Embedding generation failed:`, embeddingError);
            }
        }
        
        // Derive meal types from tags if available
        if (enrichedRecipe.tags && enrichedRecipe.tags.length > 0 && (!enrichedRecipe.meal_types || enrichedRecipe.meal_types.length === 0)) {
            enrichedRecipe.meal_types = deriveMealTypesFromTags(enrichedRecipe.tags);
            console.log(`✅ Meal types derived: ${enrichedRecipe.meal_types.join(', ')}`);
        }
        
        // Create parsed recipe data compatible with existing interface  
        const parsedRecipe: ParsedRecipeData = {
            ...enrichedRecipe,
            title: enrichedRecipe.title || 'Untitled Recipe',
            description: enrichedRecipe.description || undefined,
            image_url: enrichedRecipe.image_url || undefined, 
            servings: typeof enrichedRecipe.servings === 'string' ? (parseInt(enrichedRecipe.servings) || undefined) : (enrichedRecipe.servings || undefined),
            prep_time_minutes: enrichedRecipe.prep_time_minutes ?? undefined,
            cook_time_minutes: enrichedRecipe.cook_time_minutes ?? undefined,
            total_time_minutes: enrichedRecipe.total_time_minutes ?? undefined,
            effort_level: enrichedRecipe.effort_level ? String(enrichedRecipe.effort_level) : undefined,
            created_by: enrichedRecipe.created_by || undefined,
            ingredients: enrichedRecipe.ingredients,
            instructions: enrichedRecipe.instructions,
            source_url: enrichedRecipe.source_url
        };
        
        console.log(`✅ Comprehensive enrichment completed with ${enrichedRecipe.completeness_score}% completeness`);
        
        return parsedRecipe;
        
    } catch (enrichmentError) {
        console.warn(`⚠️ Comprehensive enrichment failed, falling back to basic parsing:`, enrichmentError);
        
        // Fallback to basic parsing if enrichment fails
        return await parseRecipeDataBasic(rawRecipe);
    }
}

/*
 * Fallback basic parsing function (original implementation)
 */
async function parseRecipeDataBasic(rawRecipe: RawScrapedRecipe): Promise<ParsedRecipeData> {
    console.log(`🔄 Using basic parsing for recipe: "${rawRecipe.title}"`);
    
    // Parse ingredients using enhanced ingredient parser
    const ingredients: RecipeIngredient[] = [];
    const ingredientErrors: string[] = [];
    
    for (const rawIngredient of rawRecipe.ingredients) {
        const parsed = await processIngredient({ name: rawIngredient });
        if (parsed) {
            ingredients.push(parsed);
        } else {
            ingredientErrors.push(rawIngredient);
            console.warn(`⚠️ Failed to parse ingredient: "${rawIngredient}"`);
            
            // Create fallback ingredient object to prevent data loss
            ingredients.push({
                text: rawIngredient,
                name: rawIngredient.split(' ').slice(-2).join(' '), // Use last two words as name
                quantity: undefined,
                unit: undefined,
                notes: undefined,
                category: undefined,
                grams: undefined,
                order_index: ingredients.length
            });
        }
    }
    
    // Parse instructions using enhanced instruction parser
    const instructions = processInstructions(rawRecipe.instructions, ingredients);
    
    // Create initial parsed recipe object
    const initialParsedRecipe: ParsedRecipeData = {
        ...rawRecipe,
        ingredients,
        instructions,
        source_url: rawRecipe.source_url
    };
    
    // Comprehensive validation and field completion
    const validationResult = await RecipeValidator.validateAndFixRecipe(
        initialParsedRecipe as Partial<Recipe>, 
        rawRecipe.source_url
    );
    
    // Log validation results
    if (validationResult.errors.length > 0) {
        console.warn(`⚠️ Validation found ${validationResult.errors.length} errors:`);
        validationResult.errors.forEach(error => {
            console.warn(`  • ${error.field}: ${error.message}`);
        });
    }
    
    if (validationResult.fixedFields.length > 0) {
        console.log(`🔧 Fixed ${validationResult.fixedFields.length} fields:`);
        validationResult.fixedFields.forEach(fix => {
            console.log(`  • ${fix.field}: ${fix.fixMethod}`);
        });
    }
    
    console.log(`✅ Recipe validation completed with ${validationResult.completenessScore}% completeness`);
    console.log(`   Parsed ${ingredients.length} ingredients and ${instructions.length} instructions`);
    
    if (ingredientErrors.length > 0) {
        console.warn(`⚠️ ${ingredientErrors.length} ingredients had parsing issues but fallbacks were created`);
    }
    
    // Return the validated and fixed recipe data
    return initialParsedRecipe;
}

/*
 * Scrape recipe data from a URL by fetching the HTML and parsing it
 */
export async function scrapeWebsite(url: string): Promise<RawScrapedRecipe> {
    // Import robust fetch utility
    const { fetchText } = await import('../utils/robustFetch.js');
    
    console.log(`🔍 Scraping recipe from: ${url}`);
    const html = await fetchText(url, {
        maxRetries: 3,
        timeout: 30000
    });
    
    // Use the common HTML parsing function to get raw scraped data
    const rawRecipe = await scrapeFromHtml(url, html);
    
    return rawRecipe;
}

/*
 * Extract image URL from JSON-LD data
 */
export function extractImageUrl(imageData: any): string | undefined {
    if (!imageData) return undefined;
    if (typeof imageData === 'string') return imageData;
    if (Array.isArray(imageData)) {
        const firstImage = imageData[0];
        if (typeof firstImage === 'string') return firstImage;
        if (typeof firstImage === 'object' && firstImage !== null && firstImage.url) {
            return firstImage.url;
        }
    }
    if (typeof imageData === 'object' && imageData !== null && imageData.url) {
        return imageData.url;
    }
    return undefined;
}

/*
 * Scrape recipe data directly from HTML content
 * This allows reusing already fetched HTML for both scraping and metadata extraction
 */
export async function scrapeFromHtml(url: string, html: string): Promise<RawScrapedRecipe> {
        
    const $ = cheerio.load(html);

    // Strategy 1: Attempt to parse structured JSON-LD data (Highest Priority)
    const jsonLdElements = $('script[type="application/ld+json"]');
    console.log(`Found ${jsonLdElements.length} JSON-LD scripts for ${url}`);
    
    // Iterate through all JSON-LD scripts to find recipe data
    for (let i = 0; i < jsonLdElements.length; i++) {
        const jsonLdText = $(jsonLdElements[i]).html()?.trim();
        if (jsonLdText && jsonLdText.includes('Recipe')) {
            try {
                console.log(`Checking JSON-LD script ${i + 1} for recipe data...`);
                // Sanitize JSON-LD text to remove control characters that cause parsing errors
                const sanitizedJsonLd = jsonLdText
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                    .replace(/\\u0000/g, '') // Remove escaped null characters
                    .replace(/\\[bfnrtv]/g, ' ') // Replace other escaped control chars with spaces
                    .trim();
                
                const data = JSON.parse(sanitizedJsonLd);
                const graph = Array.isArray(data) ? data : (data['@graph'] || [data]);
                const recipeJson = graph.find((item: any) => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));

                if (recipeJson) {
                    console.log(`Successfully parsed JSON-LD for ${url}`);
                    // Enhanced time parsing with multiple format support
                    const prepTime = (() => {
                        const prep = recipeJson.prepTime;
                        if (!prep) return undefined;
                        
                        // Handle complex ISO 8601 duration format (P0Y0M0DT0H20M0.000S)
                        if (typeof prep === 'string' && prep.startsWith('P')) {
                            const timeMatch = prep.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
                            if (timeMatch) {
                                const [, years, months, days, hours, minutes, seconds] = timeMatch;
                                const totalMinutes = 
                                    (parseInt(years || '0') * 365 * 24 * 60) +
                                    (parseInt(months || '0') * 30 * 24 * 60) +
                                    (parseInt(days || '0') * 24 * 60) +
                                    (parseInt(hours || '0') * 60) +
                                    parseInt(minutes || '0') +
                                    Math.round(parseFloat(seconds || '0') / 60);
                                return totalMinutes;
                            }
                        }
                        
                        // Handle simple ISO 8601 duration format (PT15M, PT1H30M)
                        if (typeof prep === 'string' && prep.startsWith('PT')) {
                            const hours = prep.match(/PT(\d+)H/) ? parseInt(prep.match(/PT(\d+)H/)![1]) : 0;
                            const minutes = prep.match(/(\d+)M/) ? parseInt(prep.match(/(\d+)M/)![1]) : 0;
                            return hours * 60 + minutes;
                        }
                        
                        // Handle plain numbers or strings with numbers
                        const numMatch = String(prep).match(/\d+/);
                        return numMatch ? parseInt(numMatch[0]) : undefined;
                    })();
                    
                    const cookTime = (() => {
                        const cook = recipeJson.cookTime;
                        if (!cook) return undefined;
                        
                        // Handle complex ISO 8601 duration format (P0Y0M0DT0H45M0.000S)
                        if (typeof cook === 'string' && cook.startsWith('P')) {
                            const timeMatch = cook.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
                            if (timeMatch) {
                                const [, years, months, days, hours, minutes, seconds] = timeMatch;
                                const totalMinutes = 
                                    (parseInt(years || '0') * 365 * 24 * 60) +
                                    (parseInt(months || '0') * 30 * 24 * 60) +
                                    (parseInt(days || '0') * 24 * 60) +
                                    (parseInt(hours || '0') * 60) +
                                    parseInt(minutes || '0') +
                                    Math.round(parseFloat(seconds || '0') / 60);
                                return totalMinutes;
                            }
                        }
                        
                        // Handle simple ISO 8601 duration format (PT25M, PT1H15M)
                        if (typeof cook === 'string' && cook.startsWith('PT')) {
                            const hours = cook.match(/PT(\d+)H/) ? parseInt(cook.match(/PT(\d+)H/)![1]) : 0;
                            const minutes = cook.match(/(\d+)M/) ? parseInt(cook.match(/(\d+)M/)![1]) : 0;
                            return hours * 60 + minutes;
                        }
                        
                        // Handle plain numbers or strings with numbers
                        const numMatch = String(cook).match(/\d+/);
                        return numMatch ? parseInt(numMatch[0]) : undefined;
                    })();
                    
                    // Calculate total time
                    const totalTime = (() => {
                        // First try totalTime field from JSON-LD
                        if (recipeJson.totalTime) {
                            const total = recipeJson.totalTime;
                            
                            // Handle complex ISO 8601 duration format (P0Y0M0DT1H5M0.000S)
                            if (typeof total === 'string' && total.startsWith('P')) {
                                const timeMatch = total.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
                                if (timeMatch) {
                                    const [, years, months, days, hours, minutes, seconds] = timeMatch;
                                    const totalMinutes = 
                                        (parseInt(years || '0') * 365 * 24 * 60) +
                                        (parseInt(months || '0') * 30 * 24 * 60) +
                                        (parseInt(days || '0') * 24 * 60) +
                                        (parseInt(hours || '0') * 60) +
                                        parseInt(minutes || '0') +
                                        Math.round(parseFloat(seconds || '0') / 60);
                                    return totalMinutes;
                                }
                            }
                            
                            // Handle simple ISO 8601 duration format (PT1H5M)
                            if (typeof total === 'string' && total.startsWith('PT')) {
                                const hours = total.match(/PT(\d+)H/) ? parseInt(total.match(/PT(\d+)H/)![1]) : 0;
                                const minutes = total.match(/(\d+)M/) ? parseInt(total.match(/(\d+)M/)![1]) : 0;
                                return hours * 60 + minutes;
                            }
                            
                            const numMatch = String(total).match(/\d+/);
                            if (numMatch) return parseInt(numMatch[0]);
                        }
                        
                        // Fallback: calculate from prep + cook if both available
                        if (prepTime && cookTime) {
                            return prepTime + cookTime;
                        }
                        
                        // Use whichever is available
                        return prepTime || cookTime || undefined;
                    })();
                    
                    const jsonLdRecipe: RawScrapedRecipe = {
                        title: recipeJson.name || 'Untitled Recipe',
                        description: recipeJson.description,
                        image_url: extractImageUrl(recipeJson.image),
                        servings: (() => {
                            // Enhanced servings parsing with range support
                            const yieldValue = Array.isArray(recipeJson.recipeYield) 
                                ? recipeJson.recipeYield[0] 
                                : recipeJson.recipeYield;
                            
                            if (!yieldValue) return 4; // Default fallback
                            
                            const yieldStr = String(yieldValue);
                            
                            // Handle ranges like "2-3", "4 to 6", "serves 2-4"
                            const rangeMatch = yieldStr.match(/(\d+)\s*(?:[-–—]|to)\s*(\d+)/);
                            if (rangeMatch) {
                                // Take the higher number for consistency
                                const higher = parseInt(rangeMatch[2], 10);
                                return isNaN(higher) ? 4 : Math.min(Math.max(higher, 1), 50);
                            }
                            
                            // Try to extract single number from string (e.g., "4 servings" → 4)
                            const numMatch = yieldStr.match(/\d+/);
                            if (numMatch) {
                                const parsed = parseInt(numMatch[0], 10);
                                return isNaN(parsed) ? 4 : Math.min(Math.max(parsed, 1), 50);
                            }
                            
                            return 4; // Final fallback
                        })(),
                        prep_time_minutes: prepTime,
                        cook_time_minutes: cookTime,
                        total_time_minutes: totalTime,
                        ingredients: (() => {
                            const ingredientList = recipeJson.recipeIngredient || [];
                            // Ensure we have strings and clean them up
                            return Array.isArray(ingredientList) 
                                ? ingredientList.map(ing => 
                                    typeof ing === 'string' 
                                        ? ing.trim()
                                        : (ing?.text || ing?.name || String(ing)).trim()
                                  ).filter(Boolean)
                                : [];
                        })(),
                        instructions: (() => {
                            const instructionList = recipeJson.recipeInstructions || [];
                            // Ensure we have strings and clean them up
                            return Array.isArray(instructionList)
                                ? instructionList.map(inst =>
                                    typeof inst === 'string'
                                        ? inst.trim()
                                        : (inst?.text || inst?.name || String(inst)).trim()
                                  ).filter(Boolean)
                                : [];
                        })(),
                        author: recipeJson.author?.name || recipeJson.author || 'Unknown',
                        source_url: url,
                        cuisines: recipeJson.recipeCuisine ? 
                            Array.isArray(recipeJson.recipeCuisine) ? recipeJson.recipeCuisine : [recipeJson.recipeCuisine]
                            : undefined,
                        meal_types: recipeJson.recipeCategory ? 
                            Array.isArray(recipeJson.recipeCategory) ? recipeJson.recipeCategory : [recipeJson.recipeCategory]
                            : undefined,
                        tags: recipeJson.keywords ? 
                            Array.isArray(recipeJson.keywords) ? recipeJson.keywords : [recipeJson.keywords]
                            : undefined
                    };
                    
                    console.log(`✅ Successfully extracted recipe data from JSON-LD for ${url}`);
                    console.log(`📊 Ingredients found: ${jsonLdRecipe.ingredients.length}`);
                    console.log(`📝 Instructions found: ${jsonLdRecipe.instructions.length}`);
                    console.log(`🍽️ Servings: ${jsonLdRecipe.servings}`);
                    
                    return jsonLdRecipe;
                }
            } catch (e: any) {
                console.warn(`Could not parse JSON-LD script ${i + 1} for ${url}. Error: ${e.message}`);
                // Continue to next script
            }
        }
    }

    // Strategy 2: Fallback to manual HTML scraping if JSON-LD fails
    console.log(`Using fallback HTML scraping for ${url}`);
    // Enhanced selectors for title, ingredients, and instructions to support more sites
        const titleSelectors = [
        'h1#article-heading_1-0', // Allrecipes
        'h1.o-AssetTitle__a-Headline span', // Food Network
        'h1.headline.heading-content',
        'h1[data-module="MarkupText"]', // Food52
        '.recipe-title',
        '.t-headline',
        'h1'
    ].join(', ');
    const title = $(titleSelectors).first().text().trim();
        const ingredientSelectors = [
        'ul.mntl-structured-ingredients__list li', // Allrecipes
        'div.o-Ingredients__m-Body ul li.o-Ingredients__a-ListItem span.o-Ingredients__a-Ingredient--CheckboxLabel', // Food Network
        'ul[data-module="IngredientList"] li[data-module="Ingredient"]', // Food52 structured
        '.recipe-ingredients li',
        '.ingredients-list li',
        '.ingredient-item',
        'li[itemprop="recipeIngredient"]'
    ].join(', ');
    let ingredientElements = $(ingredientSelectors).toArray();
    
    // Food52-specific ingredient detection if no structured ingredients found
    if (ingredientElements.length === 0 && url.includes('food52.com')) {
        console.log(`[Fallback Debug] Trying Food52-specific ingredient detection...`);
        const allLiElements = $('ul li').toArray();
        const ingredientPatterns = /\b\d+(\.\d+)?\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|grams?|g\b|cloves?|pieces?|slices?|sprigs?)/i;
        
        ingredientElements = allLiElements.filter(li => {
            const text = $(li).text().trim();
            return ingredientPatterns.test(text) && text.length > 5 && text.length < 200;
        });
        
        console.log(`[Fallback Debug] Food52 ingredient detection found: ${ingredientElements.length} elements`);
    }
    
        const instructionSelectors = [
        '#recipe__steps-content_1-0 li.mntl-sc-block-group__list-item p', // Allrecipes
        'div.o-Method__m-Body ol li.o-Method__a-ListItem', // Food Network
        'ol[data-module="InstructionList"] li[data-module="Instruction"]', // Food52
        '.recipe-instructions li',
        '.instructions-list li',
        '.direction-list li',
        'li[itemprop="recipeInstructions"]'
    ].join(', ');
    let instructionElements = $(instructionSelectors).toArray();
    
    // Food52-specific instruction detection using JSON-LD if no structured instructions found
    if (instructionElements.length === 0 && url.includes('food52.com')) {
        console.log(`[Fallback Debug] Trying Food52 JSON-LD instruction extraction...`);
        const jsonLdScripts = $('script[type="application/ld+json"]');
        
        for (let i = 0; i < jsonLdScripts.length; i++) {
            try {
                const scriptContent = $(jsonLdScripts[i]).html();
                if (scriptContent && scriptContent.includes('Recipe')) {
                    // Sanitize JSON-LD content to remove control characters
                    const sanitized = scriptContent.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
                    const jsonData = JSON.parse(sanitized);
                    
                    if (jsonData.recipeInstructions && Array.isArray(jsonData.recipeInstructions)) {
                        // Create virtual elements for instructions from JSON-LD
                        instructionElements = jsonData.recipeInstructions.map((instruction: any) => {
                            const text = typeof instruction === 'string' ? instruction : instruction.text || instruction.name || '';
                            return { text: text.trim() }; // Use 'text' property to match normalizeStrings expectation
                        }).filter((inst: any) => inst.text.length > 10);
                        
                        console.log(`[Fallback Debug] Food52 JSON-LD instructions found: ${instructionElements.length} elements`);
                        break;
                    }
                }
            } catch (e) {
                console.log(`[Fallback Debug] Failed to parse JSON-LD script ${i + 1}:`, e instanceof Error ? e.message : String(e));
            }
        }
    }

    console.log(`[Fallback Debug] URL: ${url}`);
    console.log(`[Fallback Debug] Title found: "${title}"`);
    console.log(`[Fallback Debug] Ingredient elements found: ${ingredientElements.length}`);
    console.log(`[Fallback Debug] Instruction elements found: ${instructionElements.length}`);

    if (!title || ingredientElements.length === 0 || instructionElements.length === 0) {
        throw new Error(`Fallback scraping failed on ${url}`);
    }

    const ingredients = normalizeStrings(ingredientElements, $);
    const instructions = normalizeStrings(instructionElements, $);
    
    // Enhanced fallback scraping with robust field filling
    const fallbackRecipe: RawScrapedRecipe = {
        title,
        description: $('meta[name="description"]').attr('content') || undefined,
        image_url: $('meta[property="og:image"]').attr('content') || undefined,
        ingredients,
        instructions,
        source_url: url,
        
        // Enhanced servings extraction with Food Network specific selectors
        servings: (() => {
            // Food Network specific selectors first
            const yieldLi = $('li').filter((i, el) => $(el).text().includes('Yield:'));
            if (yieldLi.length > 0) {
                const yieldText = yieldLi.find('.o-RecipeInfo__a-Description').text().trim();
                // Handle ranges like "6 to 8 servings" - take the higher number
                const rangeMatch = yieldText.match(/(\d+)\s+to\s+(\d+)/);
                if (rangeMatch) {
                    const higher = parseInt(rangeMatch[2], 10);
                    if (higher > 0 && higher <= 50) return higher;
                }
                // Handle single numbers
                const numMatch = yieldText.match(/\d+/);
                if (numMatch) {
                    const parsed = parseInt(numMatch[0], 10);
                    if (parsed > 0 && parsed <= 50) return parsed;
                }
            }
            
            // Generic servings selectors fallback
            const servingsSelectors = [
                '.recipe-servings',
                '.servings',
                '.yield',
                '.recipe-yield',
                '[data-servings]',
                '.nutrition-summary .servings'
            ];
            
            for (const selector of servingsSelectors) {
                const element = $(selector).first();
                if (element.length > 0) {
                    const text = element.text().trim();
                    const numMatch = text.match(/\d+/);
                    if (numMatch) {
                        const parsed = parseInt(numMatch[0], 10);
                        if (parsed > 0 && parsed <= 50) return parsed;
                    }
                }
            }
            
            // Check data attributes
            const servingsAttr = $('[data-servings]').first().attr('data-servings');
            if (servingsAttr) {
                const parsed = parseInt(servingsAttr, 10);
                if (parsed > 0 && parsed <= 50) return parsed;
            }
            
            return 4; // Default fallback
        })(),
        
        // Enhanced timing extraction with Food Network specific selectors
        prep_time_minutes: (() => {
            // Food Network specific selectors first
            const prepLi = $('li').filter((i, el) => $(el).text().includes('Prep:'));
            if (prepLi.length > 0) {
                const timeText = prepLi.find('.o-RecipeInfo__a-Description').text().trim();
                const numMatch = timeText.match(/\d+/);
                if (numMatch) {
                    const parsed = parseInt(numMatch[0], 10);
                    if (parsed > 0 && parsed <= 600) return parsed;
                }
            }
            
            // Generic timing selectors fallback
            const timingSelectors = [
                '.recipe-prep-time',
                '.prep-time',
                '.preparation-time',
                '[data-prep-time]',
                '.time-prep'
            ];
            
            for (const selector of timingSelectors) {
                const element = $(selector).first();
                if (element.length > 0) {
                    const text = element.text().trim();
                    const numMatch = text.match(/\d+/);
                    if (numMatch) {
                        const parsed = parseInt(numMatch[0], 10);
                        if (parsed > 0 && parsed <= 600) return parsed;
                    }
                }
            }
            
            // Estimate from instructions if not found
            return estimatePrepTimeFromInstructions(instructions);
        })(),
        
        cook_time_minutes: (() => {
            // Food Network specific selectors first
            const cookLi = $('li').filter((i, el) => $(el).text().includes('Cook:'));
            if (cookLi.length > 0) {
                const timeText = cookLi.find('.o-RecipeInfo__a-Description').text().trim();
                const numMatch = timeText.match(/\d+/);
                if (numMatch) {
                    const parsed = parseInt(numMatch[0], 10);
                    if (parsed > 0 && parsed <= 600) return parsed;
                }
            }
            
            // Generic timing selectors fallback
            const timingSelectors = [
                '.recipe-cook-time',
                '.cook-time',
                '.cooking-time',
                '[data-cook-time]',
                '.time-cook'
            ];
            
            for (const selector of timingSelectors) {
                const element = $(selector).first();
                if (element.length > 0) {
                    const text = element.text().trim();
                    const numMatch = text.match(/\d+/);
                    if (numMatch) {
                        const parsed = parseInt(numMatch[0], 10);
                        if (parsed > 0 && parsed <= 600) return parsed;
                    }
                }
            }
            
            // Estimate from instructions if not found
            return estimateCookTimeFromInstructions(instructions);
        })(),
        
        // Robust author extraction
        author: (() => {
            const authorSelectors = [
                '.recipe-author .author-name',
                '.recipe-byline .author',
                '.recipe-credit .author',
                '.by-author .author-name',
                '.author-bio .author-name',
                '.author-name',
                '.byline-author',
                '.post-author',
                '.entry-author',
                'a[rel="author"]',
                '.byline .author',
                'span[itemprop="author"] span[itemprop="name"]',
                'span[itemprop="author"]',
                '[itemtype*="Person"] [itemprop="name"]'
            ];
            
            for (const selector of authorSelectors) {
                const element = $(selector).first();
                if (element.length > 0) {
                    const text = element.text().trim();
                    if (text && text.length > 2 && text.length < 100 && !text.toLowerCase().includes('recipe')) {
                        return text;
                    }
                }
            }
            
            // Check meta tags
            const metaAuthor = $('meta[name="author"]').attr('content') || 
                             $('meta[property="article:author"]').attr('content') ||
                             $('meta[name="twitter:creator"]').attr('content');
            if (metaAuthor && metaAuthor.length > 2 && metaAuthor.length < 100) {
                return metaAuthor.replace('@', '').trim();
            }
            
            // Generate fallback author from domain
            try {
                const domain = new URL(url).hostname.replace('www.', '');
                const capitalizedDomain = domain.split('.')[0]
                    .split(/[-_]/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                return `${capitalizedDomain} Recipe`;
            } catch {
                return 'Recipe Author';
            }
        })()
    };
    
    // Calculate total time from prep + cook
    if (fallbackRecipe.prep_time_minutes && fallbackRecipe.cook_time_minutes) {
        fallbackRecipe.total_time_minutes = fallbackRecipe.prep_time_minutes + fallbackRecipe.cook_time_minutes;
    } else if (fallbackRecipe.prep_time_minutes || fallbackRecipe.cook_time_minutes) {
        fallbackRecipe.total_time_minutes = (fallbackRecipe.prep_time_minutes || 0) + (fallbackRecipe.cook_time_minutes || 0);
    }
    
    return fallbackRecipe;
}

/*
 * Calculate health score from nutrition data (0-100 scale)
 * Higher scores indicate healthier recipes
 */
function calculateHealthScore(nutrition: Nutrition): number {
    let score = 50; // Base score
    
    // Positive factors
    if (nutrition.proteinG && nutrition.proteinG > 10) score += 15;
    if (nutrition.fiberG && nutrition.fiberG > 5) score += 15;
    if (nutrition.calories && nutrition.calories < 400) score += 10;
    
    // Negative factors
    if (nutrition.saturatedFatG && nutrition.saturatedFatG > 5) score -= 10;
    if (nutrition.sodiumG && nutrition.sodiumG > 600) score -= 10;
    if (nutrition.sugarG && nutrition.sugarG > 15) score -= 10;
    
    // Ensure score is within bounds
    return Math.max(0, Math.min(100, Math.round(score)));
}

/*
 * Generate recipe embedding using Google Gemini API
 */
async function generateRecipeEmbedding(text: string): Promise<number[] | null> {
    try {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ Google AI API key not found, skipping embedding generation');
            return null;
        }
        
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        
        const model = genAI.getGenerativeModel({ model: 'embedding-001' });
        const result = await model.embedContent(text);
        
        return result.embedding.values;
    } catch (error) {
        console.warn('⚠️ Failed to generate embedding:', error);
        return null;
    }
}

/*
 * Derive meal types from recipe tags
 */
function deriveMealTypesFromTags(tags: string[]): string[] {
    const mealTypes: string[] = [];
    const tagString = tags.join(' ').toLowerCase();
    
    // Common meal type mappings
    const mealMappings = {
        'breakfast': ['breakfast', 'brunch', 'morning'],
        'lunch': ['lunch', 'midday', 'sandwich'],
        'dinner': ['dinner', 'evening', 'main course', 'entree'],
        'dessert': ['dessert', 'sweet', 'cake', 'cookie', 'pie'],
        'snack': ['snack', 'appetizer', 'finger food'],
        'side': ['side', 'side dish', 'accompaniment']
    };
    
    for (const [mealType, keywords] of Object.entries(mealMappings)) {
        if (keywords.some(keyword => tagString.includes(keyword))) {
            mealTypes.push(mealType.charAt(0).toUpperCase() + mealType.slice(1));
        }
    }
    
    // Default to Main Course if no specific meal type found
    if (mealTypes.length === 0) {
        mealTypes.push('Main Course');
    }
    
    return [...new Set(mealTypes)]; // Remove duplicates
}