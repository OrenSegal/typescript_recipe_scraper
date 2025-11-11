import { supabase } from '../supabaseClient.ts';
import type { Recipe } from '../models.ts';

/*
 * Handles all database operations for recipes.
 * Methods are static so they can be called without instantiating the class.
 */
export class DatabaseService {

  /*
   * Saves a complete recipe (including relational ingredients and instructions)
   * to the database within a transaction-like process.
   * @param recipe The fully processed Recipe object.
   * @returns An object containing the ID of the saved recipe or an error.
   */
  static async saveRecipe(recipe: Recipe): Promise<{ data: { id: string } | null; error: Error | null }> {
    // 1. Prepare recipe data for the 'recipes' table, excluding relational fields.
    // We use snake_case here to match the Supabase database schema directly.
    const { ingredients, instructions, ...coreRecipeData } = recipe;
    const recipeToSave = {
      ...coreRecipeData,
      source_url: coreRecipeData.sourceUrl, // Map from camelCase to snake_case
      publisher_website: coreRecipeData.publisherWebsite,
      yield_text: coreRecipeData.yieldText,
      prep_time_minutes: coreRecipeData.prepTimeMinutes,
      cook_time_minutes: coreRecipeData.cookTimeMinutes,
      total_time_minutes: coreRecipeData.totalTimeMinutes,
      cooking_method: coreRecipeData.cookingMethod,
      effort_level: coreRecipeData.effortLevel,
      health_score: coreRecipeData.healthScore,
      meal_types: coreRecipeData.mealTypes,
      suitable_for_diet: coreRecipeData.suitableForDiet,
      is_public: coreRecipeData.isPublic,
      publish_date: coreRecipeData.publishDate,
      image_url: coreRecipeData.imageUrl,
    };
    

    const { data: savedRecipe, error: recipeError } = await supabase
      .from('recipes')
      .upsert(recipeToSave, { onConflict: 'source_url' }) // Update if recipe from this URL already exists
      .select('id')
      .single();

    if (recipeError) {
      console.error('Error saving recipe:', recipeError);
      return { data: null, error: recipeError as unknown as Error };
    }

    if (!savedRecipe) {
      return { data: null, error: new Error('Failed to save recipe, no ID returned.') };
    }

    const recipeId = savedRecipe.id;

    // Transaction Part 2: Clear and insert relational data
    // Delete old entries to ensure data consistency on updates
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    await supabase.from('instructions').delete().eq('recipe_id', recipeId);

    // TODO: A robust implementation would first find/create entries in the master 'ingredients' table
    // and then use those foreign keys here. This is a simplified version for now.
    const recipeIngredientsData = ingredients.map(ing => ({
      recipe_id: recipeId,
      ingredient_id: ing.ingredient_id, // This should be a valid FK
      display_text: ing.display_text,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes,
    }));

    if (recipeIngredientsData.length > 0) {
      const { error: ingredientsError } = await supabase.from('recipe_ingredients').insert(recipeIngredientsData);
      if (ingredientsError) return { data: null, error: ingredientsError as unknown as Error };
    }

    const instructionsData = instructions.map(inst => ({
      recipe_id: recipeId,
      step_number: inst.step_number,
      text: inst.text,
    }));

    if (instructionsData.length > 0) {
      const { error: instructionsError } = await supabase.from('instructions').insert(instructionsData);
      if (instructionsError) return { data: null, error: instructionsError as unknown as Error };
    }

    console.log(`INFO (DatabaseService): Successfully saved recipe ${recipeId}`);
    try {
    const { data, error } = await supabase.rpc('upsert_recipe_with_relations', {
      recipe_data: recipeToSave,
      ingredients_data: ingredients,
      instructions_data: instructions,
    });

    if (error) {
      throw error;
    }

    return { data: { id: data }, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}}