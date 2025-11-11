/**
 * Production Constants
 * 
 * Centralized constants following DRY principle - single source of truth
 * for all configuration values, magic numbers, and reusable constants
 * 
 * Consolidated from:
 * - ingredientParser.ts (DENSITY_MAP, CATEGORY_MAPPING, preparations, etc.)
 * - instructionParser.ts (COOKING_ABBREVIATIONS, validActions, etc.)
 * - All scattered configuration constants
 */

// ===== SCRAPING CONFIGURATION =====
export const SCRAPING_CONFIG = {
  // Rate limiting
  DEFAULT_DELAY_MS: 1000,
  MAX_CONCURRENT_REQUESTS: 3,
  RETRY_ATTEMPTS: 3,
  TIMEOUT_MS: 30000,
  
  // Content validation
  MIN_TITLE_LENGTH: 5,
  MIN_INGREDIENT_COUNT: 2,
  MIN_INSTRUCTION_COUNT: 1,
  MAX_RECIPE_LENGTH: 50000,
  
  // Success thresholds
  RECIPE_DETECTION_THRESHOLD: 0.3,
  MIN_CONFIDENCE_SCORE: 0.5,
  
  // Batch processing
  BATCH_SIZE: 50,
  MAX_BATCH_SIZE: 100,
  PROGRESS_REPORT_INTERVAL: 10
} as const;

// ===== CLI CONFIGURATION =====
export const CLI_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  MAX_OUTPUT_LINES: 1000,
  PROGRESS_UPDATE_INTERVAL: 5000,
  VERBOSE_LOGGING: false
} as const;

// ===== SOCIAL MEDIA CONFIGURATION =====
export const SOCIAL_MEDIA_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 2,
  DEFAULT_DELAY_MS: 2000,
  MAX_RETRIES: 3,
  TIMEOUT_MS: 45000,
  MAX_ACCOUNT_ITEMS: 100
} as const;

// ===== DEPLOYMENT CONFIGURATION =====
export const DEPLOYMENT_CONFIG = {
  BATCH_SIZE: 50,
  MAX_RETRIES: 5,
  TIMEOUT_MS: 60000,
  BACKUP_ENABLED: true,
  HEALTH_CHECK_INTERVAL: 30000
} as const;

// ===== TESTING CONFIGURATION =====
export const TESTING_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  SAMPLE_SIZE: 10,
  MAX_PROCESSING_TIME: 5000,
  PERFORMANCE_THRESHOLD: 1000
} as const;

// ===== VALIDATION CONFIGURATION =====
export const VALIDATION_CONFIG = {
  MIN_CONFIDENCE_SCORE: 80,
  REQUIRED_FIELDS: ['title', 'ingredients', 'instructions'],
  MAX_VALIDATION_TIME: 5000
} as const;

// ===== DATABASE CONFIGURATION =====
export const DATABASE_CONFIG = {
  MAX_CONNECTIONS: 20,
  CONNECTION_TIMEOUT_MS: 10000,
  QUERY_TIMEOUT_MS: 30000,
  BATCH_SIZE: 50,
  MAX_RETRIES: 3
} as const;

// ===== OCR PROCESSING =====
export const OCR_CONFIG = {
  FRAME_EXTRACTION_INTERVAL: 1, // seconds
  MAX_FRAMES_TO_PROCESS: 30,
  CONFIDENCE_THRESHOLD: 0.5,
  RECIPE_KEYWORD_THRESHOLD: 3,
  MAX_VIDEO_DURATION: 300, // 5 minutes
  MAX_VIDEO_LENGTH: 300, // 5 minutes (alias for compatibility)
  RECIPE_CONTENT_THRESHOLD: 3, // minimum recipe signals needed
  TEMP_DIR_PREFIX: 'video_ocr_',
  FRAME_FORMAT: 'png',
  IMAGE_QUALITY: 90,
  EDGE_DETECTION_THRESHOLD: 0.01
} as const;

// ===== ENRICHMENT CONFIGURATION =====
export const ENRICHMENT_CONFIG = {
  // Nutrition
  NUTRITION_API_TIMEOUT: 5000,
  NUTRITION_RETRY_ATTEMPTS: 2,
  
  // Health scoring
  MIN_HEALTH_SCORE: 0,
  MAX_HEALTH_SCORE: 100,
  
  // Embedding generation
  EMBEDDING_DIMENSIONS: 768,
  EMBEDDING_BATCH_SIZE: 10,
  
  // AI enhancement
  AI_TIMEOUT_MS: 10000,
  AI_MAX_TOKENS: 2000
} as const;

// ===== INGREDIENT PROCESSING CONSTANTS =====
// Sophisticated density mapping with categories for better maintainability
export const INGREDIENT_DENSITIES = {
  // Flours (g/mL)
  FLOURS: {
    'flour': 0.53, 'all-purpose flour': 0.53, 'bread flour': 0.53, 
    'whole wheat flour': 0.53, 'cake flour': 0.48, 'pastry flour': 0.50
  },
  
  // Sugars (g/mL)
  SUGARS: {
    'sugar': 0.84, 'granulated sugar': 0.84, 'brown sugar': 0.93, 
    'powdered sugar': 0.56, 'confectioners sugar': 0.56, 'raw sugar': 0.84
  },
  
  // Fats (g/mL)
  FATS: {
    'butter': 0.91, 'margarine': 0.91, 'oil': 0.92, 'vegetable oil': 0.92, 
    'olive oil': 0.92, 'coconut oil': 0.92, 'lard': 0.92
  },
  
  // Liquids (g/mL)
  LIQUIDS: {
    'water': 1.0, 'milk': 1.03, 'cream': 0.99, 'honey': 1.4, 
    'maple syrup': 1.3, 'corn syrup': 1.4, 'vinegar': 1.0
  },
  
  // Seasonings (g/mL)
  SEASONINGS: {
    'salt': 1.2, 'baking soda': 0.69, 'baking powder': 0.69, 
    'yeast': 0.69, 'vanilla extract': 0.88
  },
  
  // Proteins (g/mL)
  PROTEINS: {
    'egg': 0.98, 'egg white': 1.03, 'egg yolk': 0.95
  }
} as const;

// Sophisticated ingredient category mapping with hierarchical structure
export const INGREDIENT_CATEGORIES = {
  PROTEINS: {
    MEAT: ['beef', 'pork', 'lamb', 'veal', 'venison', 'bacon', 'ham', 'sausage'],
    POULTRY: ['chicken', 'turkey', 'duck', 'goose', 'quail'],
    SEAFOOD: ['fish', 'salmon', 'tuna', 'cod', 'halibut', 'shrimp', 'crab', 'lobster', 'scallops', 'mussels', 'clams', 'oysters']
  },
  
  DAIRY: {
    MILK_PRODUCTS: ['milk', 'buttermilk', 'heavy cream', 'light cream', 'sour cream', 'half and half'],
    CHEESE: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'swiss', 'goat cheese', 'cream cheese', 'ricotta', 'feta'],
    BUTTER_PRODUCTS: ['butter', 'clarified butter', 'ghee', 'margarine'],
    YOGURT_PRODUCTS: ['yogurt', 'greek yogurt', 'plain yogurt']
  },
  
  VEGETABLES: {
    AROMATICS: ['onion', 'garlic', 'shallot', 'leek', 'scallion', 'green onion'],
    ROOT_VEGETABLES: ['carrot', 'potato', 'sweet potato', 'beet', 'turnip', 'parsnip', 'radish'],
    LEAFY_GREENS: ['spinach', 'kale', 'lettuce', 'arugula', 'chard', 'cabbage', 'bok choy'],
    CRUCIFEROUS: ['broccoli', 'cauliflower', 'brussels sprouts'],
    NIGHTSHADES: ['tomato', 'bell pepper', 'eggplant', 'jalapeño', 'serrano', 'poblano'],
    SQUASH_FAMILY: ['zucchini', 'yellow squash', 'butternut squash', 'acorn squash', 'pumpkin'],
    MUSHROOMS: ['mushroom', 'shiitake', 'portobello', 'cremini', 'button mushroom'],
    HERBS_FRESH: ['basil', 'cilantro', 'parsley', 'mint', 'dill', 'chives', 'tarragon']
  },
  
  FRUITS: {
    CITRUS: ['lemon', 'lime', 'orange', 'grapefruit', 'tangerine'],
    BERRIES: ['strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry'],
    STONE_FRUITS: ['peach', 'plum', 'apricot', 'cherry', 'nectarine'],
    TREE_FRUITS: ['apple', 'pear', 'banana', 'avocado']
  },
  
  PANTRY_STAPLES: {
    FLOURS: ['flour', 'all-purpose flour', 'bread flour', 'whole wheat flour', 'cake flour'],
    SUGARS: ['sugar', 'brown sugar', 'powdered sugar', 'honey', 'maple syrup'],
    OILS: ['oil', 'olive oil', 'vegetable oil', 'canola oil', 'coconut oil'],
    VINEGARS: ['vinegar', 'balsamic vinegar', 'rice vinegar', 'white wine vinegar'],
    BROTHS: ['stock', 'chicken stock', 'beef stock', 'vegetable stock', 'broth'],
    CONDIMENTS: ['soy sauce', 'worcestershire sauce', 'hot sauce', 'mustard', 'ketchup'],
    BAKING: ['baking soda', 'baking powder', 'yeast', 'vanilla extract', 'cornstarch']
  },
  
  HERBS_SPICES: {
    DRIED_HERBS: ['oregano', 'thyme', 'rosemary', 'sage', 'bay leaves'],
    WHOLE_SPICES: ['peppercorns', 'coriander seeds', 'cumin seeds', 'fennel seeds'],
    GROUND_SPICES: ['pepper', 'paprika', 'cumin', 'chili powder', 'garlic powder', 'onion powder'],
    HOT_SPICES: ['aleppo pepper', 'red pepper flakes', 'chili flakes', 'cayenne', 'chipotle']
  },
  
  GRAINS_CEREALS: {
    RICE: ['rice', 'brown rice', 'white rice', 'jasmine rice', 'basmati rice', 'arborio rice'],
    PASTA: ['pasta', 'spaghetti', 'penne', 'fusilli', 'linguine', 'fettuccine'],
    GRAINS: ['quinoa', 'barley', 'bulgur', 'farro', 'oats', 'wheat berries']
  },
  
  LEGUMES: {
    BEANS: ['beans', 'black beans', 'kidney beans', 'navy beans', 'pinto beans', 'cannellini beans'],
    LENTILS: ['lentils', 'red lentils', 'green lentils', 'french lentils'],
    PEAS: ['peas', 'split peas', 'chickpeas', 'black-eyed peas']
  },
  
  NUTS_SEEDS: {
    NUTS: ['almonds', 'walnuts', 'pecans', 'hazelnuts', 'pistachios', 'cashews', 'peanuts'],
    SEEDS: ['sesame seeds', 'sunflower seeds', 'pumpkin seeds', 'chia seeds', 'flax seeds']
  }
} as const;

// Non-standard units with estimated weights (more sophisticated approach)
export const NON_STANDARD_UNITS = {
  // Count-based items
  COUNT_ITEMS: {
    'egg': 50, 'eggs': 50, 'large egg': 50, 'medium egg': 44, 'small egg': 38,
    'clove': 3, 'cloves': 3, 'garlic clove': 3,
    'lemon': 60, 'lemons': 60, 'lime': 30, 'limes': 30,
    'onion': 150, 'onions': 150, 'medium onion': 150, 'large onion': 250, 'small onion': 100,
    'carrot': 60, 'carrots': 60, 'medium carrot': 60, 'large carrot': 100,
    'rib': 10, 'ribs': 10, 'stalk': 10, 'stalks': 10,
    'piece': 50, 'pieces': 50
  },
  
  // Bunch/bundle items
  BUNDLE_ITEMS: {
    'bunch': 30, 'bunches': 30,
    'head': 200, 'heads': 200,
    'bulb': 150, 'bulbs': 150,
    'sprig': 2, 'sprigs': 2,
    'leaf': 1, 'leaves': 1, 'bay leaf': 1, 'bay leaves': 1
  },
  
  // Descriptive amounts
  DESCRIPTIVE_AMOUNTS: {
    'pinch': 0.5, 'pinches': 0.5,
    'dash': 0.6, 'dashes': 0.6,
    'splash': 5, 'splashes': 5,
    'handful': 30, 'handfuls': 30,
    'scoop': 15, 'scoops': 15
  }
} as const;

// Unit mappings and normalizations
export const UNIT_MAPPINGS = {
  // Volume units
  VOLUME: {
    'c': 'cup', 'c.': 'cup', 'cup': 'cup', 'cups': 'cup',
    'tbsp': 'tablespoon', 'tbsp.': 'tablespoon', 'tablespoon': 'tablespoon', 'tablespoons': 'tablespoon',
    'tsp': 'teaspoon', 'tsp.': 'teaspoon', 'teaspoon': 'teaspoon', 'teaspoons': 'teaspoon',
    'fl oz': 'fluid ounce', 'fl. oz': 'fluid ounce', 'fluid ounce': 'fluid ounce', 'fluid ounces': 'fluid ounce',
    'pt': 'pint', 'pt.': 'pint', 'pint': 'pint', 'pints': 'pint',
    'qt': 'quart', 'qt.': 'quart', 'quart': 'quart', 'quarts': 'quart',
    'gal': 'gallon', 'gal.': 'gallon', 'gallon': 'gallon', 'gallons': 'gallon',
    'ml': 'milliliter', 'mL': 'milliliter', 'milliliter': 'milliliter', 'milliliters': 'milliliter',
    'l': 'liter', 'L': 'liter', 'liter': 'liter', 'liters': 'liter'
  },
  
  // Weight units
  WEIGHT: {
    'oz': 'ounce', 'oz.': 'ounce', 'ounce': 'ounce', 'ounces': 'ounce',
    'lb': 'pound', 'lb.': 'pound', 'lbs': 'pound', 'lbs.': 'pound', 'pound': 'pound', 'pounds': 'pound',
    'g': 'gram', 'g.': 'gram', 'gram': 'gram', 'grams': 'gram',
    'kg': 'kilogram', 'kg.': 'kilogram', 'kilogram': 'kilogram', 'kilograms': 'kilogram'
  },
  
  // Length units (for items like pasta, vegetables)
  LENGTH: {
    'in': 'inch', 'in.': 'inch', 'inch': 'inch', 'inches': 'inch',
    'cm': 'centimeter', 'cm.': 'centimeter', 'centimeter': 'centimeter', 'centimeters': 'centimeter'
  }
} as const;

// Preparation methods and qualifiers
export const PREPARATION_METHODS = {
  CUTTING: ['chopped', 'diced', 'minced', 'sliced', 'julienned', 'cubed', 'shredded', 'grated'],
  COOKING: ['cooked', 'roasted', 'grilled', 'sautéed', 'braised', 'steamed', 'boiled', 'fried'],
  PREPARATION: ['peeled', 'seeded', 'cored', 'trimmed', 'cleaned', 'washed', 'dried'],
  TEMPERATURE: ['room temperature', 'chilled', 'frozen', 'thawed', 'warmed'],
  TEXTURE: ['mashed', 'pureed', 'crushed', 'ground', 'whole', 'halved', 'quartered']
} as const;

// Quality descriptors
export const QUALITY_DESCRIPTORS = {
  SIZE: ['large', 'medium', 'small', 'extra large', 'jumbo', 'baby'],
  FRESHNESS: ['fresh', 'ripe', 'overripe', 'young', 'mature'],
  COLOR: ['red', 'green', 'yellow', 'white', 'purple', 'orange', 'black'],
  ORIGIN: ['organic', 'local', 'imported', 'wild', 'farm-raised', 'free-range'],
  GRADE: ['premium', 'choice', 'select', 'grade a', 'extra virgin', 'virgin']
} as const;

// Compound food terms for better recognition
export const COMPOUND_FOOD_TERMS = {
  CANNED: ['canned', 'can of', 'tinned'],
  FROZEN: ['frozen', 'freeze-dried'],
  PACKAGED: ['package', 'pkg', 'container', 'box of'],
  DAIRY_PRODUCTS: ['whole milk', 'skim milk', '2% milk', 'heavy cream', 'light cream', 'sour cream'],
  CHEESE_VARIETIES: ['cheddar cheese', 'mozzarella cheese', 'parmesan cheese', 'swiss cheese', 'goat cheese'],
  MEAT_CUTS: ['chicken breast', 'chicken thigh', 'ground beef', 'beef chuck', 'pork shoulder', 'lamb chop'],
  VEGETABLE_TYPES: ['bell pepper', 'sweet potato', 'cherry tomato', 'roma tomato', 'green beans']
} as const;

// Pluralization mappings
export const PLURAL_TO_SINGULAR = {
  // Common food plurals
  'tomatoes': 'tomato', 'potatoes': 'potato', 'onions': 'onion', 'carrots': 'carrot',
  'eggs': 'egg', 'cloves': 'clove', 'leaves': 'leaf', 'berries': 'berry',
  'cherries': 'cherry', 'strawberries': 'strawberry', 'blueberries': 'blueberry',
  'mushrooms': 'mushroom', 'beans': 'bean', 'peas': 'pea', 'nuts': 'nut',
  'herbs': 'herb', 'spices': 'spice', 'peppers': 'pepper', 'olives': 'olive',
  
  // Units
  'cups': 'cup', 'tablespoons': 'tablespoon', 'teaspoons': 'teaspoon',
  'ounces': 'ounce', 'pounds': 'pound', 'grams': 'gram', 'kilograms': 'kilogram',
  'pieces': 'piece', 'slices': 'slice', 'strips': 'strip'
} as const;

// ===== COOKING METHODS AND ACTIONS =====

// Action time weights for cooking method extraction
export const ACTION_TIME_WEIGHTS = {
  // High priority - main cooking methods
  'bake': 10, 'roast': 10, 'grill': 10, 'broil': 10, 'fry': 10, 'steam': 10,
  'boil': 10, 'simmer': 9, 'sauté': 9, 'braise': 9, 'stew': 9,
  
  // Medium priority - preparation methods
  'mix': 5, 'stir': 4, 'whisk': 4, 'beat': 4, 'fold': 4,
  'chop': 3, 'dice': 3, 'slice': 3, 'mince': 3,
  
  // Low priority - assembly
  'combine': 2, 'add': 2, 'place': 1, 'serve': 1
} as const;

// Comprehensive cooking abbreviations mapping
export const COOKING_ABBREVIATIONS = {
  // Units and measurements
  'qt.': 'quart', 'qts.': 'quarts', 'pt.': 'pint', 'pts.': 'pints',
  'gal.': 'gallon', 'gals.': 'gallons', 'lb.': 'pound', 'lbs.': 'pounds',
  'oz.': 'ounce', 'ozs.': 'ounces', 'tbsp.': 'tablespoon', 'tbsps.': 'tablespoons',
  'tsp.': 'teaspoon', 'tsps.': 'teaspoons', 'c.': 'cup', 'cups.': 'cups',
  'fl.': 'fluid', 'fl. oz.': 'fluid ounce', 'fl oz': 'fluid ounce',
  'sq.': 'square', 'sq': 'square', 'in.': 'inch', 'ins.': 'inches',
  'ft.': 'foot', 'feet.': 'feet', 'cm.': 'centimeter', 'cms.': 'centimeters',
  'mm.': 'millimeter', 'mms.': 'milliliters', 'ml.': 'milliliter', 'mls.': 'milliliters',
  'l.': 'liter', 'ls.': 'liters', 'g.': 'gram', 'gs.': 'grams', 'gr.': 'gram',
  'kg.': 'kilogram', 'kgs.': 'kilograms', 'deg.': 'degrees',
  
  // Cooking terms
  'temp.': 'temperature', 'temps.': 'temperatures', 'min.': 'minute', 'mins.': 'minutes',
  'hr.': 'hour', 'hrs.': 'hours', 'sec.': 'second', 'secs.': 'seconds',
  'w/': 'with', 'w/o': 'without', '&': 'and', '+': 'and',
  'approx.': 'approximately', 'apx.': 'approximately', 'etc.': 'etcetera',
  'incl.': 'including', 'prep.': 'prepare', 'prepped.': 'prepared',
  'refrig.': 'refrigerate', 'thru': 'through', 'til': 'until', "'til": 'until',
  
  // Equipment and containers
  'cooker.': 'cooker', 'pot.': 'pot', 'pan.': 'pan', 'skillet.': 'skillet',
  'dish.': 'dish', 'oven.': 'oven', 'stove.': 'stove', 'burner.': 'burner',
  'pkg.': 'package', 'pkgs.': 'packages', 'cont.': 'container', 'conts.': 'containers',
  'btl.': 'bottle', 'btls.': 'bottles', 'can.': 'can', 'cans.': 'cans',
  'jar.': 'jar', 'jars.': 'jars', 'box.': 'box', 'boxes.': 'boxes'
} as const;

// Valid cooking actions with variations
export const VALID_COOKING_ACTIONS = {
  PRIMARY: ['bake', 'roast', 'grill', 'fry', 'sauté', 'boil', 'steam', 'braise', 'stew', 'simmer'],
  PREPARATION: ['mix', 'stir', 'whisk', 'beat', 'fold', 'chop', 'dice', 'slice', 'mince'],
  ASSEMBLY: ['combine', 'add', 'layer', 'stuff', 'roll', 'wrap', 'serve']
} as const;

// Common action variations for fuzzy matching
export const ACTION_VARIATIONS = {
  'bake': ['baking', 'baked', 'bakes'],
  'roast': ['roasting', 'roasted', 'roasts'],
  'grill': ['grilling', 'grilled', 'grills'],
  'fry': ['frying', 'fried', 'fries'],
  'sauté': ['sautéing', 'sautéed', 'sautés', 'saute', 'sauteed'],
  'boil': ['boiling', 'boiled', 'boils'],
  'steam': ['steaming', 'steamed', 'steams'],
  'mix': ['mixing', 'mixed', 'mixes'],
  'stir': ['stirring', 'stirred', 'stirs'],
  'chop': ['chopping', 'chopped', 'chops']
} as const;

// ===== RECIPE KEYWORDS (for content detection) =====
export const RECIPE_KEYWORDS = [
  // Cooking actions
  'recipe', 'cook', 'bake', 'fry', 'boil', 'simmer', 'roast', 'grill', 
  'sauté', 'mix', 'stir', 'chop', 'dice', 'slice', 'mince', 'whisk',
  
  // Measurements
  'cup', 'cups', 'tablespoon', 'tbsp', 'teaspoon', 'tsp', 'ounce', 'oz',
  'pound', 'lb', 'gram', 'g', 'kilogram', 'kg', 'liter', 'l', 'ml',
  
  // Time and temperature
  'minutes', 'min', 'hours', 'hr', 'temperature', 'degrees', 'fahrenheit',
  'celsius', 'preheat', 'cook time', 'prep time',
  
  // Common ingredients
  'ingredient', 'ingredients', 'salt', 'pepper', 'oil', 'butter', 'onion',
  'garlic', 'flour', 'sugar', 'water', 'milk', 'egg', 'eggs',
  
  // Serving and presentation
  'serve', 'serving', 'servings', 'portion', 'garnish', 'season', 'taste'
] as const;

// ===== EQUIPMENT KEYWORDS =====
export const EQUIPMENT_KEYWORDS = [
  'oven', 'stove', 'stovetop', 'microwave', 'grill', 'barbecue',
  'pan', 'pot', 'skillet', 'saucepan', 'stockpot', 'dutch oven',
  'bowl', 'mixing bowl', 'serving bowl', 'plate', 'dish',
  'whisk', 'spatula', 'wooden spoon', 'ladle', 'tongs', 'knife',
  'cutting board', 'chopping board', 'blender', 'food processor',
  'mixer', 'stand mixer', 'hand mixer', 'measuring cup', 'measuring spoons',
  'baking sheet', 'baking pan', 'cake pan', 'muffin tin', 'cookie sheet'
] as const;

export const EffortLevel = {
  1: 'very easy',
  2: 'easy',
  3: 'medium',
  4: 'hard',
  5: 'very hard'
} as const;

// ===== FILE PATHS =====
export const FILE_PATHS = {
  TEMP_DIR: 'temp',
  LOGS_DIR: 'logs',
  DATA_DIR: 'data',
  REPORTS_DIR: 'reports',
  BATCH_REPORTS: 'batch-reports',
  
  // CSV files
  WEBSITES_CSV: 'data/Data.csv',
  FAILED_SITES_CSV: 'data/failed-sites.csv',
  
  // Log files
  ERROR_LOG: 'logs/errors.log',
  SCRAPING_LOG: 'logs/scraping.log',
  OCR_LOG: 'logs/ocr.log'
} as const;

// ===== REGEX PATTERNS =====
export const PATTERNS = {
  // URL validation
  HTTP_URL: /^https?:\/\/.+/,
  RECIPE_URL: /\/(recipe|recipes)\//,
  
  // Content extraction
  QUANTITY: /(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*([a-zA-Z]+)?/,
  TIME_DURATION: /(\d+)\s*(min|minutes|hour|hours|hr|h)\b/gi,
  TEMPERATURE: /(\d+)\s*°?\s*(f|fahrenheit|c|celsius)\b/gi,
  
  // Text cleaning
  EXTRA_WHITESPACE: /\s+/g,
  MULTIPLE_NEWLINES: /\n\s*\n/g,
  HTML_TAGS: /<[^>]*>/g,
  
  // Ingredient parsing
  INGREDIENT_AMOUNT: /^(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)/,
  INGREDIENT_UNIT: /\b(cup|cups|tbsp|tsp|oz|lb|g|kg|ml|l)\b/i
} as const;

// ===== ERROR MESSAGES =====
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network request failed',
  TIMEOUT_ERROR: 'Request timed out',
  PARSING_ERROR: 'Failed to parse content',
  DATABASE_ERROR: 'Database operation failed',
  VALIDATION_ERROR: 'Data validation failed',
  OCR_ERROR: 'OCR processing failed',
  ENRICHMENT_ERROR: 'Recipe enrichment failed'
} as const;

// ===== SUCCESS MESSAGES =====
export const SUCCESS_MESSAGES = {
  RECIPE_SCRAPED: 'Recipe successfully scraped',
  RECIPE_ENRICHED: 'Recipe successfully enriched',
  RECIPE_SAVED: 'Recipe successfully saved to database',
  BATCH_COMPLETED: 'Batch processing completed',
  OCR_COMPLETED: 'OCR processing completed'
} as const;

// ===== HTTP STATUS CODES =====
export const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  TIMEOUT: 408
} as const;

// ===== NUTRITION DATA =====
export const NUTRITION_DEFAULTS = {
  SERVING_SIZE: '1 serving',
  CALORIES_PER_SERVING: null,
  PROTEIN_G: null,
  CARBS_G: null,
  FAT_G: null,
  FIBER_G: null,
  SUGAR_G: null,
  SODIUM_MG: null
} as const;

// ===== RECIPE CATEGORIES =====
export const RECIPE_CATEGORIES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch', 
  DINNER: 'dinner',
  DESSERT: 'dessert',
  SNACK: 'snack',
  APPETIZER: 'appetizer',
  BEVERAGE: 'beverage',
  SALAD: 'salad',
  SOUP: 'soup',
  MAIN_COURSE: 'main-course',
  SIDE_DISH: 'side-dish',
  SAUCE: 'sauce'
} as const;

// ===== SCRAPING CONFIGURATION (YAGNI - Only essential config) =====

export const DEFAULT_SCRAPING_CONFIG = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 15000,
  retryAttempts: 3,
  retryDelay: 1000,
  concurrentRequests: 10,
  respectRobotsTxt: true,
  rateLimitMs: 500
} as const;

export const DEFAULT_BATCH_CONFIG = {
  maxConcurrency: 5,
  timeoutMs: 30000,
  retryAttempts: 3,
  progressReportInterval: 10, // Report progress every 10 processed items
  saveResults: true,
  batchSize: 50,
  enableHealthCheck: true,
  outputDirectory: './batch-results',
  logLevel: 'info'
} as const;

export const DEFAULT_MEDIA_CONFIG = {
  enableOCR: true,
  enableTranscription: true,
  maxVideoLength: 300, // 5 minutes
  frameExtractionInterval: 30,
  ocrConfidenceThreshold: 0.7,
  recipeContentThreshold: 0.5,
  saveResults: true,
  outputDirectory: './media-results',
  logLevel: 'info'
} as const;

// ===== COOKING METHODS (KISS - Simple arrays) =====

export const COOKING_METHODS = [
  'Baking',
  'Roasting', 
  'Grilling',
  'Frying',
  'Steaming',
  'Boiling',
  'Slow Cooking',
  'No Cook',
  'Sautéing',
  'Braising',
  'Stewing',
  'Poaching',
  'Broiling'
] as const;

export const COOKING_ACTIONS = [
  'slice', 'mix', 'stir', 'whisk', 'beat', 'chop', 'dice', 'mince',
  'bake', 'roast', 'broil', 'grill', 'sauté', 'fry', 'pan-fry',
  'deep-fry', 'boil', 'steam', 'poach', 'simmer', 'braise', 'stew',
  'marinate', 'season', 'garnish', 'serve', 'chill', 'freeze',
  'thaw', 'drain', 'strain', 'blend', 'process', 'knead',
  'fold', 'combine', 'toss', 'coat', 'brush', 'sprinkle',
  'spread', 'layer', 'arrange', 'wrap', 'cover', 'uncover',
  'preheat', 'heat', 'warm', 'cool', 'rest'
] as const;

export const KITCHEN_EQUIPMENT = [
  'oven', 'stovetop', 'microwave', 'grill', 'slow cooker', 'pressure cooker',
  'air fryer', 'toaster oven', 'blender', 'food processor', 'mixer',
  'whisk', 'spatula', 'wooden spoon', 'ladle', 'tongs', 'strainer',
  'colander', 'cutting board', 'knife', 'measuring cups', 'measuring spoons',
  'mixing bowl', 'baking sheet', 'cake pan', 'loaf pan', 'muffin tin',
  'casserole dish', 'roasting pan', 'skillet', 'saucepan', 'stockpot',
  'dutch oven', 'wok', 'steamer', 'double boiler'
] as const;

// ===== MEASUREMENT UNITS (Comprehensive list) =====

export const MEASUREMENT_UNITS = [
  // Volume - US
  'teaspoon', 'tsp', 'tablespoon', 'tbsp', 'fluid ounce', 'fl oz',
  'cup', 'pint', 'quart', 'gallon',
  
  // Volume - Metric
  'milliliter', 'ml', 'liter', 'l',
  
  // Weight - US
  'ounce', 'oz', 'pound', 'lb',
  
  // Weight - Metric
  'gram', 'g', 'kilogram', 'kg',
  
  // Count/Other
  'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves',
  'head', 'bunch', 'sprig', 'sprigs', 'leaf', 'leaves',
  'pinch', 'dash', 'splash', 'handful', 'can', 'jar',
  'package', 'pkg', 'bottle'
] as const;

// ===== DIETARY RESTRICTIONS (Comprehensive) =====

export const DIETARY_RESTRICTIONS = [
  'Gluten-Free',
  'Dairy-Free', 
  'Lactose-Intolerant',
  'Nut-Free',
  'Peanut-Free',
  'Soy-Free',
  'Egg-Free',
  'Shellfish-Free',
  'Fish-Free',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Ketogenic',
  'Paleo',
  'Low Carb',
  'Sugar-Free',
  'Low Sodium',
  'Heart-Healthy',
  'Kosher',
  'Halal'
] as const;

// ===== MEAL TYPES =====

export const MEAL_TYPES = [
  'Breakfast',
  'Lunch', 
  'Dinner',
  'Snack',
  'Dessert',
  'Appetizer',
  'Side Dish',
  'Main Course',
  'Beverage',
  'Salad',
  'Soup',
  'Bread',
  'Sauce',
  'Marinade'
] as const;

// ===== CUISINE TYPES =====

export const CUISINE_TYPES = [
  'American',
  'Italian',
  'Mexican',
  'Chinese',
  'French',
  'Indian',
  'Japanese',
  'Thai',
  'Greek',
  'Spanish',
  'Mediterranean',
  'Middle Eastern',
  'Korean',
  'Vietnamese',
  'German',
  'British',
  'Russian',
  'Brazilian',
  'Moroccan',
  'Ethiopian',
  'International',
  'Fusion'
] as const;

// ===== TIME CONSTANTS (YAGNI - Only what's needed) =====

export const TIME_CONSTANTS = {
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  DEFAULT_TIMEOUT: 30000,
  RATE_LIMIT_DELAY: 500,
  MAX_RETRIES: 3
} as const;

// ===== DATABASE CONSTANTS =====

export const DATABASE_CONSTANTS = {
  MAX_CONNECTIONS: 20,
  CONNECTION_TIMEOUT: 30000,
  QUERY_TIMEOUT: 60000,
  BATCH_SIZE: 100,
  MAX_BATCH_SIZE: 1000
} as const;

// ===== API CONSTANTS =====

export const API_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100
} as const;

// ===== VALIDATION PATTERNS =====

export const VALIDATION_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  URL: /^https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,}$/,
  POSITIVE_NUMBER: /^\d*\.?\d+$/,
  FRACTION: /^\d+\/\d+$/,
  MIXED_NUMBER: /^\d+\s+\d+\/\d+$/
} as const;

// ===== ERROR CODES (SOLID - Single responsibility) =====

export const ERROR_CODES = {
  // Validation Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Scraping Errors  
  SCRAPING_FAILED: 'SCRAPING_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  PARSING_ERROR: 'PARSING_ERROR',
  
  // Database Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  QUERY_FAILED: 'QUERY_FAILED',
  
  // Processing Errors
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  ENRICHMENT_FAILED: 'ENRICHMENT_FAILED',
  
  // System Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR'
} as const;

// Export type definitions derived from constants for type safety
export type CookingMethod = typeof COOKING_METHODS[number];
export type CookingAction = typeof COOKING_ACTIONS[number]; 
export type KitchenEquipment = typeof KITCHEN_EQUIPMENT[number];
export type IngredientCategory = keyof typeof INGREDIENT_CATEGORIES | 'Pantry Staples' | 'Meat' | 'Poultry' | 'Seafood' | 'Dairy' | 'Vegetables' | 'Fruits' | 'Grains' | 'Legumes' | 'Nuts & Seeds' | 'Herbs & Spices' | 'Oils & Fats' | 'Beverages' | 'Baking' | 'Condiments' | 'Frozen' | 'Canned' | 'Snacks' | 'Alcohol' | 'Other' | 'Prepared Foods';
export type MeasurementUnit = typeof MEASUREMENT_UNITS[number];
export type DietaryRestriction = typeof DIETARY_RESTRICTIONS[number];
export type MealType = typeof MEAL_TYPES[number];
export type CuisineType = typeof CUISINE_TYPES[number];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type RecipeKeyword = typeof RECIPE_KEYWORDS[number];
export type EquipmentKeyword = typeof EQUIPMENT_KEYWORDS[number];
export type RecipeCategory = typeof RECIPE_CATEGORIES[keyof typeof RECIPE_CATEGORIES];
export type IngredientDensities = typeof INGREDIENT_DENSITIES[keyof typeof INGREDIENT_DENSITIES];

// ===== MEDIA TYPES =====
export const MEDIA_PLATFORMS = {
  INSTAGRAM: 'instagram',
  YOUTUBE: 'youtube', 
  TIKTOK: 'tiktok',
  OTHER: 'other'
} as const;

export type MediaPlatform = typeof MEDIA_PLATFORMS[keyof typeof MEDIA_PLATFORMS];

export interface MediaContent {
  url: string;
  platform: MediaPlatform;
  title?: string;
  description?: string;
  duration?: number;
  thumbnailUrl?: string;
  imageUrl?: string;
  author?: string;
  hashtags?: string[];
  extractedText?: string;
  recipeRelevant?: boolean;
}
