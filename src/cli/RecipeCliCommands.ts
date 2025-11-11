import * as fs from 'fs';
import * as path from 'path';
import { UnifiedScraper } from '../scrapers/UnifiedScraper.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { ComprehensiveEnrichment } from '../enrichment/comprehensiveEnrichment.js';

export class RecipeCliCommands {
  /**
   * Scrape a single recipe from URL
   */
  static async scrapeSingleRecipe(url: string, options: any): Promise<void> {
    console.log(`🔍 Scraping recipe from: ${url}`);
    
    try {
      const scraper = new UnifiedScraper();
      const scrapingResult = await scraper.scrapeRecipe(url);
      
      if (!scrapingResult.success || !scrapingResult.recipe) {
        console.error('❌ Failed to scrape recipe - no data returned');
        return;
      }

      const recipeData = scrapingResult.recipe;
      console.log(`✅ Successfully scraped: ${recipeData.title || 'Untitled Recipe'}`);

      // AI Enrichment (commander sets options.enrich=true by default; --no-enrich makes it false)
      if (options.enrich) {
        console.log('🧠 Enriching recipe with AI...');
        try {
          const enrichedData = await ComprehensiveEnrichment.enrichRecipe(recipeData);
          Object.assign(recipeData, enrichedData);
          console.log('✅ Recipe enrichment complete');
        } catch (enrichError) {
          console.warn('⚠️ Enrichment failed, continuing without enrichment');
        }
      }

      // Save to database
      if (options.save) {
        console.log('💾 Saving to database...');
        const db = DatabaseService.getInstance();
        await db.initialize();
        const savedRecipe = await db.saveRecipe(recipeData);
        console.log(`✅ Recipe saved with ID: ${savedRecipe.id || 'unknown'}`);
      }

      // Output to file
      if (options.output) {
        await this.outputRecipe(recipeData, options.output, options.format);
        console.log(`📄 Recipe saved to: ${options.output}`);
      }

      // Display summary
      this.displayRecipeSummary(recipeData);

    } catch (error) {
      console.error(`❌ Failed to scrape recipe: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Export all recipes from database
   */
  static async exportDatabase(options: any): Promise<void> {
    console.log('📤 Exporting database...');
    
    try {
      const db = DatabaseService.getInstance();
      await db.initialize();
      
      // Get all recipes (implement this method in DatabaseService)
      const recipes = await db.getAllRecipes();
      
      const outputFile = options.output || `recipes_export_${Date.now()}.${options.format}`;
      
      switch (options.format) {
        case 'csv':
          await this.exportToCSV(recipes, outputFile);
          break;
        case 'xlsx':
          await this.exportToExcel(recipes, outputFile);
          break;
        default:
          await this.exportToJSON(recipes, outputFile);
      }
      
      console.log(`✅ Exported ${recipes.length} recipes to: ${outputFile}`);
      
    } catch (error) {
      console.error(`❌ Export failed: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Show database statistics
   */
  static async databaseStats(): Promise<void> {
    console.log('📊 Database Statistics\n');
    
    try {
      const db = DatabaseService.getInstance();
      await db.initialize();
      
      const stats = await db.getStatistics();
      
      console.log(`Total Recipes: ${stats.totalRecipes}`);
      console.log(`Active Recipes: ${stats.activeRecipes}`);
      console.log(`Total Ingredients: ${stats.totalIngredients}`);
      console.log(`Unique Cuisines: ${stats.uniqueCuisines}`);
      console.log(`Average Cooking Time: ${stats.avgCookingTime} minutes`);
      console.log(`Most Popular Tags: ${stats.popularTags.slice(0, 5).join(', ')}`);
      console.log(`Database Size: ${stats.databaseSize}`);
      console.log(`Last Updated: ${stats.lastUpdated}`);
      
    } catch (error) {
      console.error(`❌ Failed to get database stats: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Check database health
   */
  static async databaseHealth(): Promise<void> {
    console.log('🏥 Database Health Check\n');
    
    try {
      const db = DatabaseService.getInstance();
      await db.initialize();
      
      const health = await db.healthCheck();
      
      console.log(`Connection Status: ${health.connected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`Response Time: ${health.responseTime}ms`);
      console.log(`Database Version: ${health.version}`);
      console.log(`Available Space: ${health.availableSpace}`);
      console.log(`Active Connections: ${health.activeConnections}`);
      
      if (health.issues && health.issues.length > 0) {
        console.log('\n⚠️ Issues Found:');
        health.issues.forEach((issue: string) => console.log(`  - ${issue}`));
      }
      
    } catch (error) {
      console.error(`❌ Health check failed: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Display recipe summary
   */
  private static displayRecipeSummary(recipe: any): void {
    console.log('\n📋 Recipe Summary:');
    console.log(`Title: ${recipe.title || 'N/A'}`);
    console.log(`Cuisines: ${Array.isArray(recipe.cuisines) ? recipe.cuisines.join(', ') : (recipe.cuisine_type || 'N/A')}`);
    console.log(`Servings: ${recipe.servings || 'N/A'}`);
    const totalTime = recipe.total_time_minutes ?? recipe.total_time;
    console.log(`Total Time: ${totalTime ?? 'N/A'} minutes`);
    console.log(`Ingredients: ${recipe.ingredients?.length || 0}`);
    console.log(`Instructions: ${recipe.instructions?.length || 0} steps`);
    const hs = RecipeCliCommands.computeHealthScore(recipe);
    console.log(`Health Score: ${hs}/100`);
    
    if (recipe.dietary_restrictions?.length > 0) {
      console.log(`Dietary: ${recipe.dietary_restrictions.join(', ')}`);
    }
  }

  // Lightweight fallback health score calculator for CLI display when enrichment is disabled
  private static computeHealthScore(recipe: any): number {
    const existing = recipe.health_score;
    if (typeof existing === 'number' && Number.isFinite(existing)) {
      return Math.max(0, Math.min(100, Math.round(existing)));
    }

    const n = recipe.nutrition || recipe.nutrition_info || {};
    const calories: number | undefined = Number.isFinite(n.calories) ? n.calories : undefined;
    const satFat: number | undefined = Number.isFinite(n.saturated_fat) ? n.saturated_fat : undefined;
    const sugar: number | undefined = Number.isFinite(n.sugar) ? n.sugar : undefined;
    const sodium: number | undefined = Number.isFinite(n.sodium) ? n.sodium : undefined;
    const fiber: number | undefined = Number.isFinite(n.fiber) ? n.fiber : undefined;
    const protein: number | undefined = Number.isFinite(n.protein) ? n.protein : undefined;

    let score = 70; // start from a neutral baseline

    if (typeof calories === 'number') {
      if (calories > 800) score -= 20;
      else if (calories > 600) score -= 12;
      else if (calories > 450) score -= 6;
      else if (calories < 250) score += 4;
    }

    if (typeof satFat === 'number') {
      if (satFat > 15) score -= 20;
      else if (satFat > 10) score -= 12;
      else if (satFat > 5) score -= 6;
      else if (satFat < 3) score += 4;
    }

    if (typeof sugar === 'number') {
      if (sugar > 30) score -= 12;
      else if (sugar > 20) score -= 8;
      else if (sugar > 12) score -= 4;
    }

    if (typeof sodium === 'number') {
      if (sodium > 1800) score -= 12;
      else if (sodium > 1200) score -= 8;
      else if (sodium > 800) score -= 4;
    }

    if (typeof fiber === 'number') {
      if (fiber >= 8) score += 8;
      else if (fiber >= 5) score += 5;
      else if (fiber >= 3) score += 3;
    }

    if (typeof protein === 'number') {
      if (protein >= 30) score += 6;
      else if (protein >= 20) score += 4;
      else if (protein >= 10) score += 2;
    }

    // Small nudge based on ingredients richness when no nutrition available
    if (!n || Object.keys(n).length === 0) {
      const ingCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
      if (ingCount >= 12) score -= 2; // richer recipes may be heavier
      if (ingCount <= 6 && ingCount > 0) score += 2; // simpler may be lighter
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Output recipe to file
   */
  private static async outputRecipe(recipe: any, filePath: string, format: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    switch (format) {
      case 'yaml':
        // Simple YAML-like output (avoiding yaml dependency)
        const yamlContent = Object.entries(recipe)
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join('\n');
        fs.writeFileSync(filePath, yamlContent);
        break;
      case 'csv':
        await this.outputRecipeCSV(recipe, filePath);
        break;
      default:
        fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2));
    }
  }

  /**
   * Export recipes to JSON
   */
  private static async exportToJSON(recipes: any[], filePath: string): Promise<void> {
    fs.writeFileSync(filePath, JSON.stringify(recipes, null, 2));
  }

  /**
   * Export recipes to CSV
   */
  private static async exportToCSV(recipes: any[], filePath: string): Promise<void> {
    const headers = [
      'id', 'title', 'description', 'cuisine_type', 'servings', 
      'prep_time', 'cook_time', 'total_time', 'difficulty_level',
      'health_score', 'source_url', 'created_at'
    ];
    
    const csvContent = [
      headers.join(','),
      ...recipes.map(recipe => 
        headers.map(header => 
          JSON.stringify(recipe[header] || '')
        ).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(filePath, csvContent);
  }

  /**
   * Export recipes to Excel
   */
  private static async exportToExcel(recipes: any[], filePath: string): Promise<void> {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(recipes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recipes');
    XLSX.writeFile(wb, filePath);
  }

  /**
   * Output single recipe to CSV
   */
  private static async outputRecipeCSV(recipe: any, filePath: string): Promise<void> {
    const headers = ['Field', 'Value'];
    const rows = Object.entries(recipe).map(([key, value]) => [
      key,
      typeof value === 'object' ? JSON.stringify(value) : String(value)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => JSON.stringify(cell)).join(','))
    ].join('\n');
    
    fs.writeFileSync(filePath, csvContent);
  }
}
