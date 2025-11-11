/**
 * Production OCR Constants and Configuration
 * Centralized constants following DRY/SOLID principles
 */

export const OCR_CONSTANTS = {
  // Frame extraction settings
  DEFAULT_FRAME_INTERVAL: 1.0, // Extract frame every 1 second
  MIN_TEXT_CONFIDENCE: 0.7,
  MAX_FRAMES_PER_VIDEO: 300,
  
  // Processing thresholds
  RECIPE_DETECTION_THRESHOLD: 0.3,
  EDGE_DETECTION_THRESHOLD: 0.1,
  MIN_RECIPE_INGREDIENTS: 3,
  MIN_RECIPE_INSTRUCTIONS: 3,
  
  // Performance limits
  MAX_PROCESSING_TIME_MS: 10000, // 10 seconds max
  DEFAULT_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  
  // File paths and directories
  TEMP_OCR_DIR: './temp/ocr-frames',
  FRAME_FILENAME_PATTERN: 'frame_%04d.png',
  
  // FFMPEG arguments template
  FFMPEG_ARGS_TEMPLATE: {
    INPUT: ['-i'],
    VIDEO_FILTER: ['-vf'],
    FPS_FILTER: (interval: number) => `fps=1/${interval}`,
    OVERWRITE: ['-y']
  }
} as const;

export const RECIPE_KEYWORDS = [
  // Core recipe terms
  'recipe', 'ingredient', 'cook', 'bake', 'fry', 'boil', 'simmer', 'roast',
  'grill', 'sauté', 'mix', 'stir', 'chop', 'dice', 'slice', 'mince',
  
  // Measurements
  'tablespoon', 'teaspoon', 'cup', 'ounce', 'pound', 'gram', 'liter',
  'tbsp', 'tsp', 'oz', 'lb', 'ml', 'kg',
  
  // Cooking terms
  'temperature', 'degrees', 'minutes', 'hours', 'serve', 'garnish',
  'season', 'taste', 'heat', 'cool', 'chill', 'freeze',
  
  // Common ingredients
  'salt', 'pepper', 'oil', 'butter', 'onion', 'garlic', 'flour', 'sugar',
  'egg', 'milk', 'cheese', 'water', 'lemon', 'lime', 'tomato'
] as const;

export const EQUIPMENT_KEYWORDS = [
  // Basic cookware
  'oven', 'pan', 'pot', 'bowl', 'mixer', 'knife', 'spatula', 'whisk',
  'spoon', 'fork', 'plate', 'cutting board', 'measuring cup', 'scale',
  
  // Appliances
  'blender', 'food processor', 'microwave', 'stovetop', 'grill', 'toaster',
  'stand mixer', 'hand mixer', 'immersion blender',
  
  // Specialized tools
  'thermometer', 'timer', 'strainer', 'colander', 'tongs', 'ladle',
  'baking sheet', 'saucepan', 'skillet', 'wok', 'dutch oven', 'casserole'
] as const;

export const COOKING_ACTIONS = [
  'mix', 'stir', 'add', 'pour', 'heat', 'cook', 'bake', 'fry', 'boil',
  'simmer', 'chop', 'dice', 'slice', 'mince', 'blend', 'whisk', 'fold',
  'sauté', 'grill', 'roast', 'steam', 'broil', 'marinate', 'season'
] as const;

export const SOCIAL_MEDIA_CONSTANTS = {
  PLATFORMS: {
    INSTAGRAM: 'instagram',
    TIKTOK: 'tiktok', 
    YOUTUBE: 'youtube'
  } as const,
  
  URL_PATTERNS: {
    INSTAGRAM: /\/(?:p|reel)\/([A-Za-z0-9_-]+)/,
    TIKTOK: /\/video\/(\d+)/,
    YOUTUBE: [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]+)/
    ]
  } as const
} as const;
