import axios, { AxiosError } from 'axios';
import { NutritionInformation } from '../services/models/Nutrition';
import { Ingredient } from '../services/models/Ingredient';
import { env } from 'process';


const USDA_API_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

interface UsdaFoodNutrient {
  nutrient: {
    id: number;
    name: string;
    unitName: string; // e.g., "G", "MG", "KCAL"
  };
  amount?: number; // Amount per 100g (or per serving if specified by foodPortion)
}

interface UsdaFoodPortion {
  id: number;
  gramWeight: number;
  portionDescription?: string; // e.g., "1.0 cup"
  modifier?: string; // e.g., "cup"
  // other fields...
}
interface UsdaFoodDetail {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: UsdaFoodNutrient[];
  foodPortions?: UsdaFoodPortion[];
  // other fields...
}

interface UsdaSearchResponse {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: UsdaFoodDetail[];
}

//Unit Conversion & Nutrient Mapping (from Python nutrition.py)
const UNIT_TO_GRAMS_ESTIMATES: Record<string, number | null> = {
  g: 1.0, gram: 1.0, kg: 1000.0, kilogram: 1000.0,
  oz: 28.3495, ounce: 28.3495, lb: 453.592, pound: 453.592,
  mg: 0.001, milligram: 0.001,
  cup: 240.0, // General estimate, varies wildly by ingredient
  cups: 240.0,
  'fl oz': 29.5735, 'fluid ounce': 29.5735,
  tbsp: 15.0, tablespoon: 15.0,
  tsp: 5.0, teaspoon: 5.0,
  ml: 1.0, milliliter: 1.0,
  l: 1000.0, liter: 1000.0,
  // Units that require USDA portion data or are item-based
  large: null, medium: null, small: null, slice: null, clove: null,
  piece: null, fillet: null, can: null, bunch: null, stalk: null,
  head: null, sprig: null,
};

// Mapping from USDA Nutrient ID to our NutritionInformation model field
const USDA_NUTRIENT_ID_TO_MODEL_FIELD: Record<number, keyof NutritionInformation> = {
  1003: 'protein', // Protein
  1004: 'fat',     // Total lipid (fat)
  1005: 'carbs',   // Carbohydrate, by difference
  1008: 'calories',// Energy (KCAL)
  2000: 'sugars',  // Sugars, total including NLEA (Added sugars are under a different ID if available)
  1079: 'fiber',   // Fiber, total dietary
  1093: 'sodium',  // Sodium, Na
  1258: 'saturatedFat', // Fatty acids, total saturated
  1253: 'cholesterol',  // Cholesterol
  1257: 'transFat',     // Fatty acids, total trans
};

// Fallback if ID is not present but name is
const NUTRIENT_NAME_TO_MODEL_FIELD_FALLBACK: Record<string, keyof NutritionInformation> = {
  protein: 'protein',
  'total lipid (fat)': 'fat',
  'carbohydrate, by difference': 'carbs',
  energy: 'calories',
  'sugars, total including nlea': 'sugars',
  'sugars, total': 'sugars',
  'fiber, total dietary': 'fiber',
  'sodium, na': 'sodium',
  'fatty acids, total saturated': 'saturatedFat',
  cholesterol: 'cholesterol',
  'fatty acids, total trans': 'transFat',
};


async function searchFoodByName(
  query: string,
  apiKey: string,
  pageSize: number = 5,
): Promise<UsdaSearchResponse | null> {
  if (!query) {
    return null;
  }

  try {
    const response = await axios.get<UsdaSearchResponse>(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${apiKey}`,
      { 
        headers: { 
          'User-Agent': 'RecipeScraper/1.0',
          'Content-Type': 'application/json'
        } 
      },
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error(`ERROR (NutritionAPI): Failed to search for food '${query}':`, axiosError.message);
    if (axiosError.response) {
      console.error('Response status:', axiosError.response.status);
      console.error('Response data:', axiosError.response.data);
    }
    return null;
  }
}

async function getFoodDetailsByFdcId(
  fdcId: string,
  apiKey: string,
): Promise<UsdaFoodDetail | null> {
  if (!fdcId) {
    console.warn('WARN (USDA API): FDC ID is empty.');
    return null;
  }
  const params = { api_key: apiKey };
  const url = `${USDA_API_BASE_URL}/food/${fdcId}`;

  try {
    const response = await axios.get<UsdaFoodDetail>(url, { params, timeout: 10000 });
    return response.data;
  } catch (e: any) {
    const error = e as AxiosError;
    console.error(`ERROR (USDA API): HTTP error for FDC ID '${fdcId}': ${error.message}. Status: ${error.response?.status}.`);
    return null;
  }
}


function getQuantityInGrams(
  quantityVal: number | string | null | undefined,
  unitVal: string | null | undefined,
  foodDescription: string, // For logging and context
  foodDetailsFromUsda?: UsdaFoodDetail | null,
): { grams: number | null; note?: string } {
  let plausibilityNote: string | undefined;
  const result: { grams: number | null; note?: string } = { grams: null };

  if (quantityVal === null || typeof quantityVal === 'undefined') {
    console.debug(`DEBUG (NutritionCalc): Quantity is null/undefined for '${foodDescription}'. Assuming 0g.`);
    result.grams = 0.0;
    return result;
  }

  let numQuantity: number;
  if (typeof quantityVal === 'number') {
    numQuantity = quantityVal;
  } else if (typeof quantityVal === 'string') {
    const rangeMatch = quantityVal.match(/(\d*\.?\d+)\s*(?:-|to|or)\s*(\d*\.?\d+)/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      numQuantity = (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
    } else {
      const mixedFracMatch = quantityVal.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)/);
      if (mixedFracMatch && mixedFracMatch[1] && mixedFracMatch[2] && mixedFracMatch[3]) {
        const w = parseFloat(mixedFracMatch[1]);
        const n = parseFloat(mixedFracMatch[2]);
        const d = parseFloat(mixedFracMatch[3]);
        if (d === 0) {
          result.note = `Invalid fraction (denominator zero) for ${quantityVal}`;
          return result;
        }
        numQuantity = w + n / d;
      } else {
        const fracMatch = quantityVal.match(/(\d+)\s*\/\s*(\d+)/);
        if (fracMatch && fracMatch[1] && fracMatch[2]) {
          const n = parseFloat(fracMatch[1]);
          const d = parseFloat(fracMatch[2]);
          if (d === 0) {
            result.note = `Invalid fraction (denominator zero) for ${quantityVal}`;
            return result;
          }
          numQuantity = n / d;
        } else {
          const parsed = parseFloat(quantityVal.replace(/[^\d.]/g, ''));
          if (isNaN(parsed)) {
            console.warn(`WARN (NutritionCalc): Cannot parse quantity string '${quantityVal}' for '${foodDescription}'.`);
            result.note = `Cannot parse quantity string '${quantityVal}'`;
            return result;
          }
          numQuantity = parsed;
        }
      }
    }
  } else {
    console.warn(`WARN (NutritionCalc): Quantity '${quantityVal}' is not a recognized type for '${foodDescription}'.`);
    result.note = `Quantity '${quantityVal}' is not a recognized type`;
    return result;
  }

  if (numQuantity === 0) {
    result.grams = 0.0;
    return result;
  }

  const unitLower = (unitVal || '').toLowerCase().trim().replace(/s$/, ''); // remove plural 's'

  // Plausibility Checks (from Python)
  if (unitLower === 'cup' && numQuantity > 16) {
    plausibilityNote = `Unusually large quantity for 'cups': ${numQuantity}`;
  } else if (unitLower.startsWith('tbsp') && numQuantity > 64) {
    plausibilityNote = `Unusually large quantity for 'tbsp': ${numQuantity}`;
  } else if (unitLower.startsWith('tsp') && numQuantity > 192) {
    plausibilityNote = `Unusually large quantity for 'tsp': ${numQuantity}`;
  } else if (unitLower === 'g' && numQuantity > 5000) {
    plausibilityNote = `Unusually large quantity in grams: ${numQuantity}g`;
  } else if (unitLower === 'kg' && numQuantity > 10) {
    plausibilityNote = `Unusually large quantity in kg: ${numQuantity}kg`;
  } else if (unitLower === 'oz' && numQuantity > 176) {
    plausibilityNote = `Unusually large quantity in oz: ${numQuantity}oz`;
  } else if (unitLower === 'lb' && numQuantity > 10) {
    plausibilityNote = `Unusually large quantity in lbs: ${numQuantity}lbs`;
  }

  if (foodDetailsFromUsda?.foodPortions) {
    const searchTermInPortion = unitLower || foodDescription!.split(',')[0]!.split('(')[0]!.trim().toLowerCase();
    for (const portion of foodDetailsFromUsda.foodPortions) {
      const portionDescFull = portion.portionDescription || portion.modifier || '';
      const portionDescLower = portionDescFull.toLowerCase().replace(/[()]/g, '');
      let matchedPortion = false;
      
      if (unitLower && portionDescLower.includes(unitLower)) {
        matchedPortion = true;
      } else if (!unitLower) { // If no unit provided by user, try to match by description
        if (numQuantity === 1 && portionDescLower.includes(searchTermInPortion)) {
          matchedPortion = true;
        } else if (portionDescLower.includes('serving') && numQuantity === 1) {
          matchedPortion = true;
        }
      }

      if (matchedPortion && typeof portion.gramWeight === 'number') {
        console.info(`INFO (NutritionCalc): Matched '${foodDescription}' (qty: ${numQuantity} unit: '${unitLower}') to USDA portion '${portionDescFull}' -> ${portion.gramWeight}g/portion_unit.`);
        result.grams = numQuantity * portion.gramWeight;
        if (plausibilityNote) {
          result.note = plausibilityNote;
        }
        return result;
      }
    }
  }

  const conversionFactor = unitLower in UNIT_TO_GRAMS_ESTIMATES ? UNIT_TO_GRAMS_ESTIMATES[unitLower] : null;
  
  if (conversionFactor !== null) {
    const volumeUnitsForWarning = ['cup', 'fl oz', 'tbsp', 'tsp', 'ml', 'l'];
    if (volumeUnitsForWarning.includes(unitLower)) {
      console.warn(
        `WARN (NutritionCalc): Using estimated volume-to-gram conversion for '${unitVal}' of '${foodDescription}'. ` +
        'Accuracy depends on ingredient density.'
      );
    }
    result.grams = numQuantity * conversionFactor!;
    if (plausibilityNote) {
      result.note = plausibilityNote;
    }
    return result;
  }

  if (!unitLower) {
    console.warn(
      `WARN (NutritionCalc): Unitless ingredient '${foodDescription}' ` +
      'could not be matched to a USDA portion with gram weight.'
    );
  } else {
    console.warn(
      `WARN (NutritionCalc): Unit '${unitVal}' for '${foodDescription}' ` +
      'not recognized or convertible to grams with available data.'
    );
  }
  
  if (plausibilityNote) {
    result.note = plausibilityNote;
  }
  return result;
}


/*
 * Calculates total nutritional information for a list of ingredients.
 * @param ingredients A list of ingredient objects (must have name, quantity, unit, cleanName).
 * @param apiKeyOverride Optional USDA API key to use instead of the one from config.
 * @returns A Promise resolving to NutritionInformation or null.
 */
export async function calculateRecipeNutrition(
  ingredients: Pick<Ingredient, 'name' | 'cleanName' | 'quantity' | 'unit' | 'validationNotes'>[],
  apiKeyOverride?: string,
): Promise<NutritionInformation | null> {
  if (!ingredients || ingredients.length === 0) return null;

  const apiKeyToUse = apiKeyOverride || env.USDA_API_KEY;
  if (!apiKeyToUse) {
    console.error('ERROR (NutritionCalc): USDA_API_KEY is not available for nutrition calculation.');
    return null;
  }

  const totalNutritionValues: Partial<NutritionInformation> = {};
  for (const key of Object.values(USDA_NUTRIENT_ID_TO_MODEL_FIELD)) {
    totalNutritionValues[key] = 0;
  }

  let processedIngredientsCount = 0;

  for (const ingData of ingredients) {
    const ingNameForSearch = ingData.cleanName || ingData.name;
    const ingDisplayName = ingData.name || 'Unknown ingredient';
    const { quantity, unit } = ingData;

    if (!ingNameForSearch || typeof quantity === 'undefined' || quantity === null) {
      console.warn(`WARN (NutritionCalc): Skipping ingredient due to missing name or quantity: ${ingDisplayName}`);
      continue;
    }
    console.info(`INFO (NutritionCalc): Processing ingredient: ${quantity} ${unit || ''} ${ingDisplayName}`);

    let searchQuery = `${ingNameForSearch}`;
    if (unit && !(unit.toLowerCase() in UNIT_TO_GRAMS_ESTIMATES && UNIT_TO_GRAMS_ESTIMATES[unit.toLowerCase()] !== null) && !['g', 'oz', 'lb', 'kg', 'mg', 'ml', 'l', 'cup', 'tsp', 'tbsp'].includes(unit.toLowerCase())) {
      searchQuery = `${unit} ${ingNameForSearch}`; // Prepend unit if it's descriptive (e.g. "large apple")
    }

    const searchResultsData = await searchFoodByName(searchQuery, apiKeyToUse);
    let fdcIdToFetch: number | undefined = undefined;
    let foodDetailsForPortions: UsdaFoodDetail | undefined | null = undefined;

    if (searchResultsData?.foods && searchResultsData.foods.length > 0) {
      let bestMatch = searchResultsData.foods[0];
      const preferredDataTypes = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
      for (const foodItem of searchResultsData.foods) {
        if (preferredDataTypes.includes(foodItem.dataType || '') && foodItem.description.toLowerCase().includes(ingNameForSearch.toLowerCase())) {
          bestMatch = foodItem;
          break;
        }
      }
      fdcIdToFetch = bestMatch!.fdcId;
      foodDetailsForPortions = bestMatch; // Use the search result directly for portion info if available
      console.info(`INFO (NutritionCalc): Found FDC ID ${fdcIdToFetch} for '${ingDisplayName}' (matched: '${bestMatch!.description}', type: ${bestMatch!.dataType})`);
    } else {
      console.warn(`WARN (NutritionCalc): No USDA search results for '${ingDisplayName}' (query: '${searchQuery}').`);
      // ✅ Add validation note for missing USDA data
      if (ingData.validationNotes) {
        ingData.validationNotes.push(`No USDA nutrition data found for '${ingDisplayName}' (query: '${searchQuery}')`);
      }
      continue;
    }

    if (!fdcIdToFetch) continue;

    const details = await getFoodDetailsByFdcId(String(fdcIdToFetch), apiKeyToUse);
    if (!details) {
      console.warn(`WARN (NutritionCalc): Could not get details for FDC ID ${fdcIdToFetch} ('${ingDisplayName}').`);
      continue;
    }

    // If search result didn't have foodPortions, use details from getFoodDetailsByFdcId
    if (!foodDetailsForPortions?.foodPortions && details.foodPortions) {
        foodDetailsForPortions = details;
    }


    const { grams, note: plausibilityNote } = getQuantityInGrams(quantity, unit, ingDisplayName, foodDetailsForPortions);
    if (plausibilityNote) {
        console.warn(`VALIDATION_NOTE (NutritionCalc): Ingredient '${ingDisplayName}' - ${plausibilityNote}`);
        // ✅ Add validation note for quantity conversion issues
        if (ingData.validationNotes) {
          ingData.validationNotes.push(`Quantity conversion: ${plausibilityNote}`);
        }
    }

    if (grams === null || grams <= 0) {
      console.warn(`WARN (NutritionCalc): Could not convert to grams or zero quantity for '${ingDisplayName}'. Skipping.`);
      continue;
    }

    processedIngredientsCount++;
    (details.foodNutrients || []).forEach(nutrientData => {
      const nutrientId = nutrientData.nutrient?.id;
      let modelField: keyof NutritionInformation | undefined = undefined;

      if (nutrientId) modelField = USDA_NUTRIENT_ID_TO_MODEL_FIELD[nutrientId];

      if (!modelField) { // Fallback to name matching
          const rawName = nutrientData.nutrient?.name?.toLowerCase();
          if (rawName) {
              for (const nameKey in NUTRIENT_NAME_TO_MODEL_FIELD_FALLBACK) {
                  if (rawName.includes(nameKey)) {
                      modelField = NUTRIENT_NAME_TO_MODEL_FIELD_FALLBACK[nameKey];
                      break;
                  }
              }
          }
      }

      if (modelField && typeof totalNutritionValues[modelField] === 'number') {
        const amountPer100g = nutrientData.amount || 0.0;
        // Ensure we are adding KCAL for calories, not KJ etc.
        if (modelField === 'calories' && nutrientData.nutrient?.unitName?.toUpperCase() !== 'KCAL') {
          if (nutrientData.nutrient?.unitName?.toUpperCase() === 'KJ') {
             console.debug(`DEBUG (NutritionCalc): Calories for ${ingDisplayName} is in KJ, converting. Amount: ${amountPer100g}`);
             (totalNutritionValues[modelField] as number) += (amountPer100g / 4.184 / 100.0) * grams;
          } else {
            console.debug(`DEBUG (NutritionCalc): Skipping non-KCAL energy value for ${ingDisplayName}: ${amountPer100g} ${nutrientData.nutrient?.unitName}`);
          }
        } else {
          (totalNutritionValues[modelField] as number) += (amountPer100g / 100.0) * grams;
        }
      }
    });
  }

  if (processedIngredientsCount === 0 && ingredients.length > 0) {
    console.warn('WARN (NutritionCalc): No ingredients successfully processed for nutrition calculation.');
    return null;
  }

  const finalNutrition: Partial<NutritionInformation> = {};
  for (const key in totalNutritionValues) {
    const modelKey = key as keyof NutritionInformation;
    if (typeof totalNutritionValues[modelKey] === 'number') {
      finalNutrition[modelKey] = parseFloat((totalNutritionValues[modelKey] as number).toFixed(2));
    } else {
      finalNutrition[modelKey] = null; // Should not happen if initialized to 0
    }
  }

  // Ensure all fields from NutritionInformation are present, even if null or 0
  const allNutritionFields = Object.keys(new NutritionInformationExample()) as Array<keyof NutritionInformation>;
  for (const field of allNutritionFields) {
      if (!(field in finalNutrition)) {
          finalNutrition[field] = null; // Or 0.0 if appropriate default
      }
  }


  return finalNutrition as NutritionInformation;
}

// Helper class to get keys of NutritionInformation for default object creation
class NutritionInformationExample implements NutritionInformation {
    calories = null;
    protein = null;
    carbs = null;
    fat = null;
    sugars = null;
    fiber = null;
    sodium = null;
    saturatedFat = null;
    cholesterol = null;
    transFat = null;
}
