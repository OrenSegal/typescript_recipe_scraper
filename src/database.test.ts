import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processAndSaveRecipe } from './database.js';
import * as aiEnrichment from './enrichment/aiEnrichment.js';
import * as nutritionEnrichment from './enrichment/nutritionEnrichment.js';
import * as dietaryRestrictionRules from './enrichment/dietaryRestrictionRules.js';
import * as db from '@supabase/supabase-js';

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => {
  const mockUpsert = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'mock-recipe-id' }, error: null });
  const mockFrom = vi.fn(() => ({
    upsert: mockUpsert,
    select: mockSelect,
    single: mockSingle,
  }));
  return { createClient: vi.fn(() => ({ from: mockFrom })) };
});

// Mock enrichment modules
vi.mock('./enrichment/aiEnrichment');
vi.mock('./enrichment/nutritionEnrichment');
vi.mock('./enrichment/dietaryRestrictionRules');

describe('processAndSaveRecipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dietaryRestrictionRules, 'getRecipeDietaryRestrictions').mockReturnValue(['Gluten-Free']);
  });

  const mockRawRecipe: any = {
    title: 'Test Cake',
    description: 'A delicious test cake recipe.',
    author: 'Test Chef',
    servings: 8,
    prep_time_minutes: 15,
    cook_time_minutes: 30,
    total_time_minutes: 45,
    ingredients: [
      { name: '1 cup flour', clean_name: 'flour', quantity: 1, unit: 'cup', notes: null, category: 'Pantry Staples', substitutes: [] },
      { name: '1 cup sugar', clean_name: 'sugar', quantity: 1, unit: 'cup', notes: null, category: 'Pantry Staples', substitutes: [] }
    ],
    instructions: [
      { step_number: 1, text: 'Mix flour and sugar.', action: null, timer_min: [], equipment: [], mentioned_ingredients: [] },
      { step_number: 2, text: 'Bake at 350.', action: null, timer_min: [], equipment: [], mentioned_ingredients: [] }
    ],
    tags: ['cake', 'dessert', 'test'],
    cuisines: ['American'],
    meal_types: ['Dessert'],
    nutrition: { calories: 500 },
    created_by: null,
  };

  it('should call all enrichment services and upsert when options are true', async () => {
    const aiSpy = vi.spyOn(aiEnrichment, 'getAiEnrichment').mockResolvedValue({ tags: ['ai-tag'] });
    vi.spyOn(nutritionEnrichment, 'getNutritionEnrichment').mockResolvedValue({
      nutrition: { calories: 500 },
      ingredients: mockRawRecipe.ingredients,
    });
    
    await processAndSaveRecipe(mockRawRecipe, 'http://test.com/cake', { include_ai: true, include_nutrition: true, generate_embedding: true });

    expect(aiSpy).toHaveBeenCalledOnce();
    
    const supabaseClient = db.createClient('', '');
    expect(supabaseClient.from).toHaveBeenCalledWith('recipes');
  });

  it('should NOT call AI enrichment service when option is false', async () => {
    const aiSpy = vi.spyOn(aiEnrichment, 'getAiEnrichment');
    vi.spyOn(nutritionEnrichment, 'getNutritionEnrichment').mockResolvedValue({
      nutrition: { calories: 500 },
      ingredients: mockRawRecipe.ingredients,
    });
    
    await processAndSaveRecipe(mockRawRecipe, 'http://test.com/cake', { include_ai: false, include_nutrition: false, generate_embedding: false });

    expect(aiSpy).not.toHaveBeenCalled();
    
    const supabaseClient = db.createClient('', '');
    expect(supabaseClient.from).toHaveBeenCalledWith('recipes');
  });
});