/*
 * Smart categorization system that avoids generic fallbacks
 */
// Cuisine detection patterns
const CUISINE_PATTERNS = {
    'Italian': [
        'pasta', 'pizza', 'risotto', 'gnocchi', 'lasagna', 'spaghetti', 'fettuccine',
        'parmesan', 'mozzarella', 'basil', 'oregano', 'marinara', 'pesto', 'carbonara',
        'bolognese', 'alfredo', 'tiramisu', 'gelato', 'prosciutto', 'pancetta'
    ],
    'Mexican': [
        'tacos', 'burritos', 'quesadillas', 'enchiladas', 'salsa', 'guacamole',
        'cilantro', 'lime', 'jalapeño', 'chipotle', 'cumin', 'chili powder',
        'tortilla', 'beans', 'avocado', 'corn', 'queso', 'chorizo', 'poblano'
    ],
    'Asian': [
        'soy sauce', 'ginger', 'garlic', 'sesame oil', 'rice vinegar', 'miso',
        'tofu', 'noodles', 'stir fry', 'wok', 'chopsticks', 'green onions',
        'bok choy', 'shiitake', 'wasabi', 'sriracha', 'hoisin', 'teriyaki'
    ],
    'Chinese': [
        'soy sauce', 'ginger', 'garlic', 'sesame oil', 'rice wine', 'cornstarch',
        'stir fry', 'wok', 'bok choy', 'shiitake', 'hoisin', 'five spice',
        'szechuan', 'kung pao', 'sweet and sour', 'lo mein', 'fried rice'
    ],
    'Indian': [
        'curry', 'turmeric', 'cumin', 'coriander', 'cardamom', 'cinnamon',
        'garam masala', 'basmati rice', 'naan', 'ghee', 'yogurt', 'lentils',
        'chickpeas', 'tandoori', 'biryani', 'masala', 'chai', 'paneer'
    ],
    'Mediterranean': [
        'olive oil', 'olives', 'feta', 'lemon', 'herbs', 'tomatoes', 'cucumber',
        'hummus', 'tahini', 'pita', 'tzatziki', 'oregano', 'rosemary', 'thyme',
        'capers', 'sun-dried tomatoes', 'pine nuts', 'couscous'
    ],
    'French': [
        'butter', 'cream', 'wine', 'herbs', 'shallots', 'baguette', 'cheese',
        'croissant', 'brie', 'camembert', 'cognac', 'champagne', 'roux',
        'béarnaise', 'hollandaise', 'coq au vin', 'bouillabaisse', 'ratatouille'
    ],
    'Thai': [
        'coconut milk', 'fish sauce', 'lime', 'lemongrass', 'galangal', 'kaffir lime',
        'thai basil', 'chili', 'pad thai', 'curry paste', 'jasmine rice',
        'peanuts', 'tamarind', 'palm sugar', 'tom yum', 'green curry'
    ],
    'Japanese': [
        'soy sauce', 'miso', 'sake', 'mirin', 'dashi', 'nori', 'wasabi',
        'ginger', 'sushi', 'sashimi', 'tempura', 'ramen', 'udon', 'soba',
        'teriyaki', 'katsu', 'edamame', 'panko', 'shiitake'
    ],
    'Middle Eastern': [
        'tahini', 'hummus', 'pita', 'falafel', 'za\'atar', 'sumac', 'pomegranate',
        'dates', 'pistachios', 'lamb', 'yogurt', 'mint', 'parsley', 'bulgur',
        'couscous', 'harissa', 'preserved lemons', 'rose water'
    ]
};
// Meal type detection patterns
const MEAL_TYPE_PATTERNS = {
    'Breakfast': [
        'eggs', 'bacon', 'pancakes', 'waffles', 'toast', 'cereal', 'oatmeal',
        'yogurt', 'granola', 'muffins', 'bagels', 'coffee', 'orange juice',
        'breakfast', 'morning', 'brunch', 'omelet', 'french toast', 'hash browns'
    ],
    'Lunch': [
        'sandwich', 'salad', 'soup', 'wrap', 'panini', 'burger', 'pizza slice',
        'lunch', 'midday', 'light meal', 'quick', 'office', 'work', 'deli'
    ],
    'Dinner': [
        'roast', 'steak', 'chicken breast', 'salmon', 'pasta', 'rice dish',
        'casserole', 'main course', 'dinner', 'evening', 'family meal',
        'hearty', 'substantial', 'protein', 'sides'
    ],
    'Appetizer': [
        'dip', 'chips', 'crackers', 'cheese board', 'bruschetta', 'canapés',
        'hors d\'oeuvres', 'starter', 'small plates', 'finger food', 'party',
        'appetizer', 'before dinner', 'snack'
    ],
    'Dessert': [
        'cake', 'cookies', 'pie', 'ice cream', 'chocolate', 'sweet', 'sugar',
        'dessert', 'after dinner', 'treat', 'baking', 'frosting', 'candy',
        'pudding', 'mousse', 'tart', 'pastry'
    ],
    'Snack': [
        'quick', 'easy', 'portable', 'on-the-go', 'between meals', 'light',
        'nuts', 'fruit', 'crackers', 'energy', 'bite-sized', 'snack'
    ],
    'Side Dish': [
        'side', 'accompaniment', 'goes with', 'serve alongside', 'complement',
        'vegetables', 'rice', 'potatoes', 'bread', 'salad'
    ]
};
// Tag generation patterns
const TAG_PATTERNS = {
    'Cooking Methods': {
        'Baked': ['bake', 'oven', 'baking', 'roast', 'roasted'],
        'Grilled': ['grill', 'grilled', 'barbecue', 'bbq', 'charcoal'],
        'Fried': ['fry', 'fried', 'deep fry', 'pan fry', 'sauté'],
        'Slow Cooked': ['slow cooker', 'crockpot', 'braised', 'stewed', 'simmered'],
        'No Cook': ['no cook', 'raw', 'fresh', 'uncooked', 'cold'],
        'One Pot': ['one pot', 'one pan', 'skillet', 'single pot'],
        'Pressure Cooker': ['instant pot', 'pressure cooker', 'pressure cook']
    },
    'Difficulty': {
        'Easy': ['easy', 'simple', 'quick', 'beginner', 'basic', '15 minutes', '20 minutes'],
        'Intermediate': ['medium', 'moderate', 'some skill', '30 minutes', '45 minutes'],
        'Advanced': ['difficult', 'complex', 'challenging', 'expert', 'professional', 'hours']
    },
    'Occasion': {
        'Weeknight': ['weeknight', 'quick dinner', 'after work', 'busy night'],
        'Weekend': ['weekend', 'leisurely', 'sunday', 'brunch', 'family time'],
        'Holiday': ['holiday', 'christmas', 'thanksgiving', 'easter', 'celebration'],
        'Party': ['party', 'entertaining', 'crowd', 'potluck', 'gathering'],
        'Date Night': ['romantic', 'date night', 'elegant', 'special occasion'],
        'Kids': ['kid-friendly', 'children', 'family', 'picky eaters']
    },
    'Dietary': {
        'Healthy': ['healthy', 'nutritious', 'wholesome', 'clean eating', 'balanced'],
        'Comfort Food': ['comfort', 'hearty', 'warming', 'cozy', 'satisfying'],
        'Light': ['light', 'fresh', 'clean', 'refreshing', 'summer'],
        'Indulgent': ['rich', 'decadent', 'indulgent', 'creamy', 'buttery']
    },
    'Season': {
        'Summer': ['summer', 'fresh', 'cold', 'grilled', 'salad', 'berries'],
        'Fall': ['fall', 'autumn', 'pumpkin', 'apple', 'warming', 'spiced'],
        'Winter': ['winter', 'warming', 'hearty', 'stew', 'soup', 'comfort'],
        'Spring': ['spring', 'fresh', 'light', 'green', 'herbs', 'asparagus']
    }
};
/*
 * Detect cuisines from recipe content
 */
export function detectCuisines(title, description, ingredients, instructions) {
    const allText = [
        title,
        description,
        ...ingredients.map(ing => ing.name),
        ...instructions.map(inst => inst.text)
    ].join(' ').toLowerCase();
    const detectedCuisines = [];
    Object.entries(CUISINE_PATTERNS).forEach(([cuisine, keywords]) => {
        const matches = keywords.filter(keyword => allText.includes(keyword.toLowerCase()));
        // Require at least 2 matches for confidence
        if (matches.length >= 2) {
            detectedCuisines.push(cuisine);
        }
    });
    // If no specific cuisine detected, try broader categories
    if (detectedCuisines.length === 0) {
        if (allText.includes('pasta') || allText.includes('pizza')) {
            detectedCuisines.push('Italian');
        }
        else if (allText.includes('rice') && (allText.includes('soy') || allText.includes('ginger'))) {
            detectedCuisines.push('Asian');
        }
        else if (allText.includes('olive oil') && allText.includes('herbs')) {
            detectedCuisines.push('Mediterranean');
        }
    }
    return detectedCuisines.length > 0 ? detectedCuisines : ['International'];
}
/*
 * Detect meal types from recipe content
 */
export function detectMealTypes(title, description, ingredients, instructions, prepTime, cookTime) {
    const allText = [
        title,
        description,
        ...ingredients.map(ing => ing.name),
        ...instructions.map(inst => inst.text)
    ].join(' ').toLowerCase();
    const detectedMealTypes = [];
    Object.entries(MEAL_TYPE_PATTERNS).forEach(([mealType, keywords]) => {
        const matches = keywords.filter(keyword => allText.includes(keyword.toLowerCase()));
        if (matches.length >= 1) {
            detectedMealTypes.push(mealType);
        }
    });
    // Time-based detection
    const totalTime = prepTime + cookTime;
    if (totalTime <= 15 && !detectedMealTypes.includes('Snack')) {
        detectedMealTypes.push('Snack');
    }
    // Ingredient-based detection
    const hasEggs = ingredients.some(ing => ing.name.toLowerCase().includes('egg'));
    const hasBacon = ingredients.some(ing => ing.name.toLowerCase().includes('bacon'));
    if ((hasEggs || hasBacon) && !detectedMealTypes.includes('Breakfast')) {
        detectedMealTypes.push('Breakfast');
    }
    // Default to lunch/dinner if nothing specific detected
    if (detectedMealTypes.length === 0) {
        if (totalTime > 45 || ingredients.length > 8) {
            detectedMealTypes.push('Dinner');
        }
        else {
            detectedMealTypes.push('Lunch');
        }
    }
    return detectedMealTypes;
}
/*
 * Generate meaningful tags from recipe content
 */
export function generateMeaningfulTags(title, description, ingredients, instructions, cuisines, mealTypes, prepTime, cookTime, effortLevel) {
    const allText = [
        title,
        description,
        ...ingredients.map(ing => ing.name),
        ...instructions.map(inst => inst.text)
    ].join(' ').toLowerCase();
    const tags = [];
    // Add cooking method tags
    Object.entries(TAG_PATTERNS['Cooking Methods']).forEach(([tag, keywords]) => {
        if (keywords.some(keyword => allText.includes(keyword.toLowerCase()))) {
            tags.push(tag);
        }
    });
    // Add difficulty tags based on effort level and time
    const totalTime = prepTime + cookTime;
    if (effortLevel <= 2 && totalTime <= 30) {
        tags.push('Easy');
    }
    else if (effortLevel >= 4 || totalTime > 120) {
        tags.push('Advanced');
    }
    else {
        tags.push('Intermediate');
    }
    // Add occasion tags
    Object.entries(TAG_PATTERNS['Occasion']).forEach(([tag, keywords]) => {
        if (keywords.some(keyword => allText.includes(keyword.toLowerCase()))) {
            tags.push(tag);
        }
    });
    // Add dietary style tags
    Object.entries(TAG_PATTERNS['Dietary']).forEach(([tag, keywords]) => {
        if (keywords.some(keyword => allText.includes(keyword.toLowerCase()))) {
            tags.push(tag);
        }
    });
    // Add seasonal tags
    Object.entries(TAG_PATTERNS['Season']).forEach(([tag, keywords]) => {
        if (keywords.some(keyword => allText.includes(keyword.toLowerCase()))) {
            tags.push(tag);
        }
    });
    // Add ingredient-based tags
    const mainIngredients = ingredients.slice(0, 3); // Focus on first 3 ingredients
    mainIngredients.forEach(ingredient => {
        const cleanName = ingredient.name;
        const mainIngredient = cleanName.split(' ')[0]; // Get first word
        if (mainIngredient.length > 3) {
            tags.push(mainIngredient.charAt(0).toUpperCase() + mainIngredient.slice(1));
        }
    });
    // Add cuisine-based tags
    cuisines.forEach(cuisine => {
        if (cuisine !== 'International') {
            tags.push(cuisine);
        }
    });
    // Add meal type tags
    mealTypes.forEach(mealType => {
        tags.push(mealType);
    });
    // Remove duplicates and return
    return [...new Set(tags)];
}
/*
 * Smart categorization that avoids generic fallbacks
 */
export function smartCategorizeRecipe(title, description = '', ingredients, instructions, prepTime = 0, cookTime = 0, effortLevel = 3) {
    const cuisines = detectCuisines(title, description, ingredients, instructions);
    const mealTypes = detectMealTypes(title, description, ingredients, instructions, prepTime, cookTime);
    const tags = generateMeaningfulTags(title, description, ingredients, instructions, cuisines, mealTypes, prepTime, cookTime, effortLevel);
    return {
        cuisines,
        mealTypes,
        tags
    };
}
