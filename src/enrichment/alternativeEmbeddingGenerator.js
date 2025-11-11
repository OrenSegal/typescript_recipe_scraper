/*
 * Alternative embedding generator that works without sharp dependency
 * Uses a simple TF-IDF approach with recipe text features
 */
// Common cooking terms and their weights for recipe embeddings
const COOKING_TERMS = {
    // Cooking methods
    'bake': 1.0, 'baking': 1.0, 'roast': 1.0, 'roasting': 1.0,
    'fry': 1.0, 'frying': 1.0, 'saute': 1.0, 'sauteing': 1.0,
    'grill': 1.0, 'grilling': 1.0, 'steam': 1.0, 'steaming': 1.0,
    'boil': 1.0, 'boiling': 1.0, 'simmer': 1.0, 'simmering': 1.0,
    // Ingredients categories
    'chicken': 0.8, 'beef': 0.8, 'pork': 0.8, 'fish': 0.8, 'seafood': 0.8,
    'vegetable': 0.7, 'vegetables': 0.7, 'fruit': 0.7, 'fruits': 0.7,
    'cheese': 0.6, 'milk': 0.6, 'cream': 0.6, 'butter': 0.6,
    'flour': 0.6, 'sugar': 0.6, 'salt': 0.6, 'pepper': 0.6,
    // Cuisines
    'italian': 0.9, 'chinese': 0.9, 'mexican': 0.9, 'indian': 0.9,
    'french': 0.9, 'japanese': 0.9, 'thai': 0.9, 'mediterranean': 0.9,
    // Meal types
    'breakfast': 0.8, 'lunch': 0.8, 'dinner': 0.8, 'dessert': 0.8,
    'appetizer': 0.7, 'snack': 0.7, 'side': 0.7,
    // Dietary
    'vegetarian': 0.8, 'vegan': 0.8, 'gluten': 0.7, 'dairy': 0.7,
    'organic': 0.6, 'healthy': 0.6, 'low': 0.6, 'high': 0.6
};
/*
 * Generate a simple but effective embedding vector for a recipe
 * This creates a 128-dimensional vector based on recipe content
 */
export function generateRecipeEmbedding(recipe) {
    const EMBEDDING_SIZE = 128;
    const embedding = new Array(EMBEDDING_SIZE).fill(0);
    // Combine all text content from the recipe
    const textContent = [
        recipe.title || '',
        recipe.description || '',
        ...(recipe.ingredients?.map(ing => ing.name) || []),
        ...(recipe.instructions?.map(inst => inst.text) || []),
        ...(recipe.cuisines || []),
        ...(recipe.meal_types || []),
        ...(recipe.tags || [])
    ].join(' ').toLowerCase();
    // Simple word frequency analysis
    const words = textContent.split(/\s+/).filter(word => word.length > 2);
    const wordFreq = {};
    words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    // Map cooking terms to embedding dimensions
    let dimensionIndex = 0;
    // First 64 dimensions: cooking terms with weights
    Object.entries(COOKING_TERMS).forEach(([term, weight]) => {
        if (dimensionIndex < 64) {
            const frequency = wordFreq[term] || 0;
            embedding[dimensionIndex] = frequency * weight;
            dimensionIndex++;
        }
    });
    // Next 32 dimensions: recipe characteristics
    const characteristics = {
        titleLength: (recipe.title?.length || 0) / 100,
        ingredientCount: (recipe.ingredients?.length || 0) / 20,
        instructionCount: (recipe.instructions?.length || 0) / 15,
        prepTime: (recipe.prep_time_minutes || 0) / 120,
        cookTime: (recipe.cook_time_minutes || 0) / 180,
        servings: (typeof recipe.servings === 'number' ? recipe.servings : 0) / 8,
        effortLevel: (recipe.effort_level || 0) / 5,
        healthScore: (recipe.health_score || 0) / 100,
        // Nutrition features (if available)
        calories: recipe.nutrition?.calories ? recipe.nutrition.calories / 1000 : 0,
        protein: recipe.nutrition?.proteinG,
        carbs: recipe.nutrition?.carbohydratesG,
        fat: recipe.nutrition?.fatG,
        // Boolean features
        hasNutrition: recipe.nutrition ? 1 : 0,
        hasImage: recipe.image_url ? 1 : 0,
        hasDescription: recipe.description ? 1 : 0,
        isPublic: recipe.is_public ? 1 : 0,
        // Cuisine diversity
        cuisineCount: recipe.cuisines?.length || 0,
        mealTypeCount: recipe.meal_types?.length || 0,
        tagCount: recipe.tags?.length || 0,
        dietaryCount: recipe.suitable_for_diet?.length || 0,
        // Text complexity
        avgWordLength: words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length / 10 : 0,
        uniqueWordRatio: words.length > 0 ? Object.keys(wordFreq).length / words.length : 0,
        // Cooking method indicators
        hasBaking: textContent.includes('bake') || textContent.includes('oven') ? 1 : 0,
        hasFrying: textContent.includes('fry') || textContent.includes('pan') ? 1 : 0,
        hasGrilling: textContent.includes('grill') || textContent.includes('barbecue') ? 1 : 0,
        hasBoiling: textContent.includes('boil') || textContent.includes('water') ? 1 : 0,
        // Dietary indicators
        isVegetarian: textContent.includes('vegetarian') || (!textContent.includes('meat') && !textContent.includes('chicken') && !textContent.includes('beef')) ? 1 : 0,
        isVegan: textContent.includes('vegan') || textContent.includes('plant-based') ? 1 : 0,
        isGlutenFree: textContent.includes('gluten-free') || textContent.includes('gluten free') ? 1 : 0,
        isDairyFree: textContent.includes('dairy-free') || textContent.includes('dairy free') ? 1 : 0,
        // Seasonal/time indicators
        isQuick: (recipe.total_time_minutes || 0) < 30 ? 1 : 0,
        isLongCook: (recipe.total_time_minutes || 0) > 120 ? 1 : 0
    };
    // Fill remaining dimensions with characteristics
    const charValues = Object.values(characteristics);
    for (let i = 64; i < Math.min(EMBEDDING_SIZE, 64 + charValues.length); i++) {
        embedding[i] = charValues[i - 64] || 0;
    }
    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] = embedding[i] / magnitude;
        }
    }
    return embedding;
}
/*
 * Calculate cosine similarity between two embedding vectors
 */
export function calculateSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
        throw new Error('Embedding vectors must have the same length');
    }
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        magnitude1 += embedding1[i] * embedding1[i];
        magnitude2 += embedding2[i] * embedding2[i];
    }
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }
    return dotProduct / (magnitude1 * magnitude2);
}
/*
 * Find similar recipes based on embedding similarity
 */
export function findSimilarRecipes(targetEmbedding, recipeEmbeddings, topK = 5) {
    const similarities = recipeEmbeddings.map(recipe => ({
        id: recipe.id,
        similarity: calculateSimilarity(targetEmbedding, recipe.embedding)
    }));
    return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
}
