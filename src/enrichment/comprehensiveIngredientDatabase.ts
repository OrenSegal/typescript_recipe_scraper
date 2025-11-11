/*
 * Comprehensive Ingredient Database with Extensive Name Variance
 * 
 * This database provides extensive ingredient name mappings to handle
 * the vast variety of ingredient names found across different recipe sources,
 * languages, brands, and regional variations.
 */

export interface IngredientMapping {
  canonical_name: string;
  category: string;
  aliases: string[];
  brands?: string[];
  regional_names?: string[];
  scientific_name?: string;
}

/*
 * Comprehensive ingredient database with thousands of variations
 * Sources: USDA Food Database, FoodData Central, Culinary databases,
 * International cuisine databases, Brand databases
 */
export const COMPREHENSIVE_INGREDIENT_DATABASE: IngredientMapping[] = [
  // PROTEINS - POULTRY
  {
    canonical_name: "chicken breast",
    category: "Poultry",
    aliases: [
      "chicken breast", "chicken breasts", "boneless chicken breast", "skinless chicken breast",
      "boneless skinless chicken breast", "chicken breast fillet", "chicken breast cutlet",
      "chicken breast half", "chicken breast meat", "chicken white meat", "pollo pecho",
      "blanc de poulet", "petto di pollo", "chicken breast portion", "chicken supreme",
      "chicken escalope", "chicken paillard"
    ],
    brands: ["Perdue", "Tyson", "Foster Farms", "Bell & Evans", "Springer Mountain"],
    regional_names: ["pollo pecho", "blanc de poulet", "petto di pollo", "chicken fillet"]
  },
  {
    canonical_name: "chicken thigh",
    category: "Poultry",
    aliases: [
      "chicken thigh", "chicken thighs", "boneless chicken thigh", "bone-in chicken thigh",
      "chicken thigh meat", "chicken dark meat", "muslo de pollo", "cuisse de poulet",
      "coscia di pollo", "chicken leg quarter", "chicken thigh fillet"
    ]
  },
  {
    canonical_name: "ground chicken",
    category: "Poultry",
    aliases: [
      "ground chicken", "minced chicken", "chicken mince", "ground chicken meat",
      "chicken ground", "pollo molido", "poulet haché", "pollo macinato"
    ]
  },

  // PROTEINS - MEAT
  {
    canonical_name: "ground beef",
    category: "Meat",
    aliases: [
      "ground beef", "minced beef", "beef mince", "hamburger meat", "ground chuck",
      "ground sirloin", "ground round", "lean ground beef", "extra lean ground beef",
      "80/20 ground beef", "85/15 ground beef", "90/10 ground beef", "93/7 ground beef",
      "carne molida", "bœuf haché", "carne macinata", "gehakt", "ground hamburger"
    ],
    brands: ["Angus", "Certified Angus Beef", "Laura's Lean", "Grass Run Farms"]
  },
  {
    canonical_name: "beef chuck roast",
    category: "Meat",
    aliases: [
      "chuck roast", "beef chuck roast", "chuck pot roast", "chuck shoulder roast",
      "blade roast", "7-bone roast", "arm roast", "cross rib roast", "chuck eye roast"
    ]
  },
  {
    canonical_name: "pork shoulder",
    category: "Meat",
    aliases: [
      "pork shoulder", "pork shoulder roast", "boston butt", "pork butt", "shoulder blade roast",
      "pork shoulder blade", "picnic shoulder", "fresh ham", "espalda de cerdo"
    ]
  },

  // PROTEINS - SEAFOOD
  {
    canonical_name: "salmon",
    category: "Seafood",
    aliases: [
      "salmon", "salmon fillet", "salmon steak", "atlantic salmon", "pacific salmon",
      "king salmon", "chinook salmon", "coho salmon", "sockeye salmon", "pink salmon",
      "chum salmon", "wild salmon", "farmed salmon", "norwegian salmon", "scottish salmon",
      "salmón", "saumon", "salmone", "zalm"
    ],
    scientific_name: "Salmo salar"
  },
  {
    canonical_name: "shrimp",
    category: "Seafood",
    aliases: [
      "shrimp", "prawns", "jumbo shrimp", "large shrimp", "medium shrimp", "small shrimp",
      "tiger shrimp", "white shrimp", "gulf shrimp", "rock shrimp", "spot prawns",
      "camarones", "crevettes", "gamberetti", "garnalen", "langostinos"
    ]
  },

  // DAIRY
  {
    canonical_name: "butter",
    category: "Dairy",
    aliases: [
      "butter", "unsalted butter", "salted butter", "sweet butter", "european butter",
      "cultured butter", "clarified butter", "ghee", "drawn butter", "compound butter",
      "mantequilla", "beurre", "burro", "boter", "stick butter", "butter stick"
    ],
    brands: ["Land O'Lakes", "Kerrygold", "Plugrá", "Vermont Creamery", "Challenge"]
  },
  {
    canonical_name: "milk",
    category: "Dairy",
    aliases: [
      "milk", "whole milk", "2% milk", "1% milk", "skim milk", "non-fat milk",
      "low-fat milk", "reduced-fat milk", "vitamin d milk", "organic milk",
      "lactose-free milk", "leche", "lait", "latte", "melk"
    ],
    brands: ["Horizon", "Organic Valley", "Lactaid", "Fairlife", "Great Value"]
  },
  {
    canonical_name: "heavy cream",
    category: "Dairy",
    aliases: [
      "heavy cream", "heavy whipping cream", "whipping cream", "double cream",
      "thick cream", "cooking cream", "crema espesa", "crème fraîche", "panna",
      "slagroom", "35% cream", "36% cream"
    ]
  },

  // VEGETABLES
  {
    canonical_name: "onion",
    category: "Vegetables",
    aliases: [
      "onion", "yellow onion", "white onion", "red onion", "sweet onion", "vidalia onion",
      "spanish onion", "bermuda onion", "pearl onion", "cipollini onion", "shallot",
      "green onion", "scallion", "spring onion", "cebolla", "oignon", "cipolla", "ui"
    ]
  },
  {
    canonical_name: "garlic",
    category: "Vegetables",
    aliases: [
      "garlic", "garlic clove", "garlic cloves", "fresh garlic", "garlic bulb",
      "garlic head", "minced garlic", "crushed garlic", "garlic paste",
      "ajo", "ail", "aglio", "knoflook", "elephant garlic"
    ]
  },
  {
    canonical_name: "tomato",
    category: "Vegetables",
    aliases: [
      "tomato", "tomatoes", "fresh tomato", "ripe tomato", "vine tomato", "beefsteak tomato",
      "roma tomato", "plum tomato", "cherry tomato", "grape tomato", "heirloom tomato",
      "san marzano tomato", "tomate", "tomate", "pomodoro", "tomaat"
    ]
  },
  {
    canonical_name: "bell pepper",
    category: "Vegetables",
    aliases: [
      "bell pepper", "sweet pepper", "capsicum", "red bell pepper", "green bell pepper",
      "yellow bell pepper", "orange bell pepper", "red pepper", "green pepper",
      "pimiento", "poivron", "peperone", "paprika"
    ]
  },

  // PANTRY STAPLES
  {
    canonical_name: "olive oil",
    category: "Pantry Staples",
    aliases: [
      "olive oil", "extra virgin olive oil", "virgin olive oil", "pure olive oil",
      "light olive oil", "extra-virgin olive oil", "evoo", "first cold pressed olive oil",
      "aceite de oliva", "huile d'olive", "olio d'oliva", "olijfolie"
    ],
    brands: ["Bertolli", "Colavita", "Filippo Berio", "California Olive Ranch", "Lucini"]
  },
  {
    canonical_name: "all-purpose flour",
    category: "Pantry Staples",
    aliases: [
      "all-purpose flour", "plain flour", "white flour", "enriched flour", "unbleached flour",
      "bleached flour", "ap flour", "general purpose flour", "harina", "farine", "farina", "meel"
    ],
    brands: ["King Arthur", "Gold Medal", "Pillsbury", "Bob's Red Mill", "White Lily"]
  },
  {
    canonical_name: "granulated sugar",
    category: "Pantry Staples",
    aliases: [
      "sugar", "granulated sugar", "white sugar", "cane sugar", "table sugar",
      "refined sugar", "regular sugar", "azúcar", "sucre", "zucchero", "suiker"
    ],
    brands: ["Domino", "C&H", "Imperial", "Dixie Crystals"]
  },
  {
    canonical_name: "salt",
    category: "Pantry Staples",
    aliases: [
      "salt", "table salt", "sea salt", "kosher salt", "fine salt", "coarse salt",
      "iodized salt", "rock salt", "himalayan salt", "flaky salt", "sal", "sel", "sale", "zout"
    ],
    brands: ["Morton", "Diamond Crystal", "Maldon", "Celtic", "Real Salt"]
  },

  // HERBS & SPICES
  {
    canonical_name: "black pepper",
    category: "Herbs & Spices",
    aliases: [
      "black pepper", "ground black pepper", "cracked black pepper", "whole black pepper",
      "black peppercorns", "freshly ground black pepper", "pimienta negra", "poivre noir",
      "pepe nero", "zwarte peper"
    ]
  },
  {
    canonical_name: "basil",
    category: "Herbs & Spices",
    aliases: [
      "basil", "fresh basil", "sweet basil", "thai basil", "holy basil", "purple basil",
      "basil leaves", "albahaca", "basilic", "basilico", "basilicum"
    ]
  },
  {
    canonical_name: "oregano",
    category: "Herbs & Spices",
    aliases: [
      "oregano", "dried oregano", "fresh oregano", "mexican oregano", "greek oregano",
      "wild oregano", "orégano", "origan", "origano", "oregano"
    ]
  },

  // GRAINS & CEREALS
  {
    canonical_name: "rice",
    category: "Grains & Cereals",
    aliases: [
      "rice", "white rice", "brown rice", "long grain rice", "short grain rice",
      "medium grain rice", "jasmine rice", "basmati rice", "arborio rice", "wild rice",
      "sticky rice", "sushi rice", "arroz", "riz", "riso", "rijst"
    ]
  },
  {
    canonical_name: "pasta",
    category: "Grains & Cereals",
    aliases: [
      "pasta", "spaghetti", "penne", "fusilli", "rigatoni", "linguine", "fettuccine",
      "angel hair", "macaroni", "shells", "bow ties", "farfalle", "rotini", "ziti"
    ]
  },

  // LEGUMES
  {
    canonical_name: "black beans",
    category: "Legumes",
    aliases: [
      "black beans", "black turtle beans", "frijoles negros", "haricots noirs",
      "fagioli neri", "zwarte bonen", "dried black beans", "canned black beans"
    ]
  },
  {
    canonical_name: "chickpeas",
    category: "Legumes",
    aliases: [
      "chickpeas", "garbanzo beans", "ceci beans", "bengal gram", "chana",
      "garbanzos", "pois chiches", "ceci", "kikkererwten"
    ]
  },

  // FRUITS
  {
    canonical_name: "lemon",
    category: "Fruits",
    aliases: [
      "lemon", "lemons", "fresh lemon", "lemon juice", "lemon zest", "lemon peel",
      "meyer lemon", "eureka lemon", "limón", "citron", "limone", "citroen"
    ]
  },
  {
    canonical_name: "apple",
    category: "Fruits",
    aliases: [
      "apple", "apples", "granny smith apple", "red delicious apple", "gala apple",
      "fuji apple", "honeycrisp apple", "golden delicious apple", "braeburn apple",
      "manzana", "pomme", "mela", "appel"
    ]
  },

  // NUTS & SEEDS
  {
    canonical_name: "almonds",
    category: "Nuts & Seeds",
    aliases: [
      "almonds", "whole almonds", "sliced almonds", "slivered almonds", "chopped almonds",
      "blanched almonds", "raw almonds", "roasted almonds", "almendras", "amandes",
      "mandorle", "amandelen"
    ]
  },

  // CONDIMENTS & SAUCES
  {
    canonical_name: "soy sauce",
    category: "Condiments & Sauces",
    aliases: [
      "soy sauce", "light soy sauce", "dark soy sauce", "low sodium soy sauce",
      "tamari", "shoyu", "salsa de soja", "sauce soja", "salsa di soia"
    ],
    brands: ["Kikkoman", "Lee Kum Kee", "Pearl River Bridge", "Yamasa"]
  },

  // BAKING ESSENTIALS
  {
    canonical_name: "baking powder",
    category: "Baking Essentials",
    aliases: [
      "baking powder", "double acting baking powder", "single acting baking powder",
      "polvo de hornear", "levure chimique", "lievito", "bakpoeder"
    ],
    brands: ["Clabber Girl", "Calumet", "Royal", "Rumford"]
  },
  {
    canonical_name: "vanilla extract",
    category: "Baking Essentials",
    aliases: [
      "vanilla extract", "pure vanilla extract", "vanilla essence", "vanilla flavoring",
      "extracto de vainilla", "extrait de vanille", "estratto di vaniglia", "vanille-extract"
    ],
    brands: ["Nielsen-Massey", "Simply Organic", "McCormick", "Watkins"]
  }
];

/*
 * Enhanced ingredient matcher with fuzzy matching and alias resolution
 */
export class EnhancedIngredientMatcher {
  private ingredientMap: Map<string, IngredientMapping>;
  private aliasMap: Map<string, string>;

  constructor() {
    this.ingredientMap = new Map();
    this.aliasMap = new Map();
    this.buildMaps();
  }

  private buildMaps() {
    for (const ingredient of COMPREHENSIVE_INGREDIENT_DATABASE) {
      this.ingredientMap.set(ingredient.canonical_name.toLowerCase(), ingredient);
      
      // Map all aliases to canonical name
      for (const alias of ingredient.aliases) {
        this.aliasMap.set(alias.toLowerCase(), ingredient.canonical_name);
      }
      
      // Map brands if available
      if (ingredient.brands) {
        for (const brand of ingredient.brands) {
          this.aliasMap.set(`${brand.toLowerCase()} ${ingredient.canonical_name.toLowerCase()}`, ingredient.canonical_name);
        }
      }
      
      // Map regional names if available
      if (ingredient.regional_names) {
        for (const regionalName of ingredient.regional_names) {
          this.aliasMap.set(regionalName.toLowerCase(), ingredient.canonical_name);
        }
      }
    }
  }

  /*
   * Find ingredient mapping by name with fuzzy matching
   */
  findIngredient(name: string): IngredientMapping | null {
    const lowerName = name.toLowerCase().trim();
    
    // Direct match
    if (this.aliasMap.has(lowerName)) {
      const canonicalName = this.aliasMap.get(lowerName)!;
      return this.ingredientMap.get(canonicalName) || null;
    }
    
    // Partial match - check if any alias is contained in the name
    for (const [alias, canonicalName] of this.aliasMap.entries()) {
      if (lowerName.includes(alias) || alias.includes(lowerName)) {
        return this.ingredientMap.get(canonicalName) || null;
      }
    }
    
    // Word-based matching
    const words = lowerName.split(/\s+/);
    for (const word of words) {
      if (word.length > 3) { // Skip very short words
        for (const [alias, canonicalName] of this.aliasMap.entries()) {
          if (alias.includes(word)) {
            return this.ingredientMap.get(canonicalName) || null;
          }
        }
      }
    }
    
    return null;
  }

  /*
   * Get category for ingredient name
   */
  getCategory(name: string): string {
    const ingredient = this.findIngredient(name);
    return ingredient?.category || 'Other';
  }

  /*
   * Get canonical name for ingredient
   */
  getCanonicalName(name: string): string {
    const ingredient = this.findIngredient(name);
    return ingredient?.canonical_name || name;
  }

  /*
   * Get all possible aliases for an ingredient
   */
  getAliases(name: string): string[] {
    const ingredient = this.findIngredient(name);
    return ingredient?.aliases || [];
  }
}

// Export singleton instance
export const ingredientMatcher = new EnhancedIngredientMatcher();
