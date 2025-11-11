import { supabase } from '../supabaseClient.ts';
import type { Recipe } from '../models.ts';

export class DatabaseService {
  static async saveRecipe(recipe: Recipe): Promise<{ data: { id: string } | null, error: Error | null }> {
    // 1. Prepare recipe data (excluding relational fields)
    const { ingredients, instructions, ...recipeData } = recipe;

    const { data: savedRecipe, error: recipeError } = await supabase
      .from('recipes')
      .upsert(recipeData, { onConflict: 'source_url' })
      .select('id')
      .single();

    if (recipeError) {
      console.error('Error saving recipe:', recipeError);
      return { data: null, error: recipeError as unknown as Error };
    }
    if (!savedRecipe) return { data: null, error: new Error('Failed to save recipe.') };

    const recipeId = savedRecipe.id;

    // 2. Clear existing ingredients and instructions for this recipe to handle updates
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    await supabase.from('instructions').delete().eq('recipe_id', recipeId);

    // 3. ✅ Implement ingredient linking to master ingredients table
    const recipeIngredientsData = [];
    
    for (const ing of ingredients) {
      let ingredientId = ing.ingredient_id;
      
      // If no ingredient_id provided, find or create in master ingredients table
      if (!ingredientId && ing.name) {
        // Try to find existing ingredient by name
        const { data: existingIngredient } = await supabase
          .from('ingredients')
          .select('id')
          .eq('name', ing.name)
          .single();
        
        if (existingIngredient) {
          ingredientId = existingIngredient.id;
        } else {
          // Create new ingredient in master table
          const { data: newIngredient, error: createError } = await supabase
            .from('ingredients')
            .insert({
              name: ing.name,
              category: 'Other', // Default category since ing.category doesn't exist
              // Add other fields as needed
            })
            .select('id')
            .single();
          
          if (createError) {
            console.warn(`Failed to create ingredient '${ing.name}':`, createError);
            continue; // Skip this ingredient if creation fails
          }
          
          ingredientId = newIngredient?.id;
        }
      }
      
      // Add to recipe_ingredients junction table
      if (ingredientId) {
        recipeIngredientsData.push({
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          display_text: ing.display_text,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
        });
      }
    }

    const { error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .insert(recipeIngredientsData);
    if (ingredientsError) return { data: null, error: ingredientsError as unknown as Error };

    // 4. Save instructions
    const instructionsData = instructions.map(inst => ({
        // id: inst.id, // DB can generate this
        recipe_id: recipeId,
        step_number: inst.step_number,
        text: inst.text,
    }));

    const { error: instructionsError } = await supabase
      .from('instructions')
      .insert(instructionsData);
    if (instructionsError) return { data: null, error: instructionsError as unknown as Error };

    console.log(`INFO (DatabaseService): Successfully saved recipe ${recipeId}`);
    return { data: { id: recipeId }, error: null };
  }
}