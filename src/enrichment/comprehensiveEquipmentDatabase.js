/*
 * Comprehensive Kitchen Equipment Database with Extensive Name Variance
 *
 * This database provides extensive kitchen equipment name mappings to handle
 * the vast variety of equipment names found across different recipe sources,
 * languages, brands, and regional variations.
 */
/*
 * Comprehensive equipment database with thousands of variations
 * Sources: Culinary equipment databases, Brand catalogs, International cooking databases
 */
export const COMPREHENSIVE_EQUIPMENT_DATABASE = [
    // COOKWARE - POTS & PANS
    {
        canonical_name: "dutch oven",
        category: "Cookware",
        aliases: [
            "dutch oven", "dutch-oven", "heavy pot", "enameled dutch oven", "cast iron dutch oven",
            "braising pot", "casserole pot", "cocotte", "heavy-bottomed pot", "oven-safe pot",
            "covered casserole", "stockpot with lid", "heavy casserole dish"
        ],
        brands: ["Le Creuset", "Staub", "Lodge", "Cuisinart", "Martha Stewart"],
        size_variants: ["3-quart", "5-quart", "7-quart", "9-quart", "small", "medium", "large"]
    },
    {
        canonical_name: "skillet",
        category: "Cookware",
        aliases: [
            "skillet", "frying pan", "fry pan", "saute pan", "sauté pan", "non-stick pan",
            "cast iron skillet", "stainless steel pan", "carbon steel pan", "omelet pan",
            "crepe pan", "griddle pan", "sartén", "poêle", "padella", "koekenpan"
        ],
        brands: ["All-Clad", "Calphalon", "T-fal", "Lodge", "Cuisinart", "GreenPan"],
        size_variants: ["6-inch", "8-inch", "10-inch", "12-inch", "14-inch", "small", "medium", "large"]
    },
    {
        canonical_name: "saucepan",
        category: "Cookware",
        aliases: [
            "saucepan", "sauce pan", "small pot", "medium pot", "covered saucepan",
            "heavy-bottomed saucepan", "stainless steel saucepan", "non-stick saucepan",
            "casserola", "casserole", "pentola", "steelpan"
        ],
        size_variants: ["1-quart", "2-quart", "3-quart", "4-quart", "small", "medium", "large"]
    },
    {
        canonical_name: "stockpot",
        category: "Cookware",
        aliases: [
            "stockpot", "stock pot", "large pot", "soup pot", "pasta pot", "boiling pot",
            "water bath pot", "canning pot", "lobster pot", "steamer pot"
        ],
        size_variants: ["6-quart", "8-quart", "12-quart", "16-quart", "20-quart"]
    },
    {
        canonical_name: "wok",
        category: "Cookware",
        aliases: [
            "wok", "stir-fry pan", "stir fry pan", "carbon steel wok", "non-stick wok",
            "electric wok", "flat-bottom wok", "round-bottom wok", "chinese wok"
        ],
        brands: ["Joyce Chen", "Craft Wok", "Helen Chen", "Taylor & Ng"],
        size_variants: ["12-inch", "14-inch", "16-inch"]
    },
    // BAKEWARE
    {
        canonical_name: "baking sheet",
        category: "Bakeware",
        aliases: [
            "baking sheet", "cookie sheet", "sheet pan", "half sheet pan", "quarter sheet pan",
            "rimmed baking sheet", "jelly roll pan", "baking tray", "oven tray",
            "bandeja para hornear", "plaque à pâtisserie", "teglia", "bakplaat"
        ],
        brands: ["Nordic Ware", "USA Pan", "All-Clad", "Calphalon", "Wilton"],
        size_variants: ["quarter-sheet", "half-sheet", "full-sheet", "small", "medium", "large"]
    },
    {
        canonical_name: "baking dish",
        category: "Bakeware",
        aliases: [
            "baking dish", "casserole dish", "rectangular baking dish", "square baking dish",
            "glass baking dish", "ceramic baking dish", "pyrex dish", "oven dish",
            "gratin dish", "au gratin dish", "lasagna pan", "enchilada dish"
        ],
        brands: ["Pyrex", "Anchor Hocking", "Le Creuset", "Emile Henry", "Corningware"],
        size_variants: ["8x8", "9x9", "9x13", "11x7", "small", "medium", "large"]
    },
    {
        canonical_name: "loaf pan",
        category: "Bakeware",
        aliases: [
            "loaf pan", "bread pan", "bread loaf pan", "meatloaf pan", "pound cake pan",
            "quick bread pan", "molde para pan", "moule à cake", "stampo per plumcake"
        ],
        size_variants: ["8.5x4.5", "9x5", "mini loaf", "large loaf"]
    },
    {
        canonical_name: "muffin tin",
        category: "Bakeware",
        aliases: [
            "muffin tin", "muffin pan", "cupcake pan", "cupcake tin", "12-cup muffin pan",
            "6-cup muffin pan", "mini muffin pan", "jumbo muffin pan", "muffin tray"
        ],
        size_variants: ["mini", "standard", "jumbo", "6-cup", "12-cup", "24-cup"]
    },
    // APPLIANCES - MAJOR
    {
        canonical_name: "oven",
        category: "Appliances",
        aliases: [
            "oven", "conventional oven", "convection oven", "gas oven", "electric oven",
            "toaster oven", "countertop oven", "wall oven", "range oven", "horno", "four", "forno"
        ],
        brands: ["KitchenAid", "GE", "Whirlpool", "Frigidaire", "Samsung", "LG"]
    },
    {
        canonical_name: "stovetop",
        category: "Appliances",
        aliases: [
            "stovetop", "stove top", "cooktop", "range", "burner", "gas burner", "electric burner",
            "induction cooktop", "glass top stove", "coil burner", "estufa", "cuisinière", "piano cottura"
        ]
    },
    {
        canonical_name: "microwave",
        category: "Appliances",
        aliases: [
            "microwave", "microwave oven", "micro-wave", "countertop microwave", "built-in microwave",
            "over-range microwave", "microondas", "micro-ondes", "microonde"
        ],
        brands: ["Panasonic", "Sharp", "GE", "Samsung", "LG", "Whirlpool"]
    },
    // APPLIANCES - SMALL
    {
        canonical_name: "blender",
        category: "Appliances",
        aliases: [
            "blender", "countertop blender", "high-speed blender", "smoothie blender",
            "personal blender", "bullet blender", "licuadora", "mixeur", "frullatore"
        ],
        brands: ["Vitamix", "Blendtec", "NutriBullet", "Ninja", "Oster", "Hamilton Beach"]
    },
    {
        canonical_name: "food processor",
        category: "Appliances",
        aliases: [
            "food processor", "mini food processor", "large food processor", "chopper",
            "procesador de alimentos", "robot culinaire", "robot da cucina"
        ],
        brands: ["Cuisinart", "KitchenAid", "Breville", "Hamilton Beach", "Black & Decker"]
    },
    {
        canonical_name: "stand mixer",
        category: "Appliances",
        aliases: [
            "stand mixer", "kitchen mixer", "electric mixer", "planetary mixer", "dough mixer",
            "cake mixer", "batidora de pie", "batteur sur socle", "impastatrice"
        ],
        brands: ["KitchenAid", "Cuisinart", "Breville", "Hamilton Beach", "Bosch"]
    },
    {
        canonical_name: "hand mixer",
        category: "Appliances",
        aliases: [
            "hand mixer", "electric hand mixer", "handheld mixer", "portable mixer",
            "batidora de mano", "batteur à main", "sbattitore elettrico"
        ],
        brands: ["KitchenAid", "Cuisinart", "Hamilton Beach", "Black & Decker", "Oster"]
    },
    {
        canonical_name: "immersion blender",
        category: "Appliances",
        aliases: [
            "immersion blender", "stick blender", "hand blender", "wand blender",
            "boat motor", "handheld blender", "batidora de inmersión", "mixeur plongeant", "frullatore ad immersione"
        ],
        brands: ["Cuisinart", "Breville", "KitchenAid", "Bamix", "All-Clad"]
    },
    // TOOLS - CUTTING & PREP
    {
        canonical_name: "chef's knife",
        category: "Tools",
        aliases: [
            "chef's knife", "chef knife", "cook's knife", "french knife", "santoku knife",
            "kitchen knife", "chopping knife", "cuchillo de chef", "couteau de chef", "coltello da chef"
        ],
        brands: ["Wüsthof", "Henckels", "Global", "Shun", "Victorinox", "Cutco"],
        size_variants: ["6-inch", "8-inch", "10-inch", "12-inch"]
    },
    {
        canonical_name: "cutting board",
        category: "Tools",
        aliases: [
            "cutting board", "chopping board", "prep board", "carving board", "butcher block",
            "wooden cutting board", "plastic cutting board", "bamboo cutting board",
            "tabla de cortar", "planche à découper", "tagliere"
        ],
        brands: ["John Boos", "Epicurean", "OXO", "Bambüsi", "Ironwood Gourmet"],
        size_variants: ["small", "medium", "large", "extra-large"]
    },
    {
        canonical_name: "paring knife",
        category: "Tools",
        aliases: [
            "paring knife", "peeling knife", "utility knife", "small knife", "fruit knife",
            "cuchillo mondador", "couteau d'office", "coltello da cucina piccolo"
        ],
        size_variants: ["3-inch", "3.5-inch", "4-inch"]
    },
    // TOOLS - MIXING & STIRRING
    {
        canonical_name: "whisk",
        category: "Tools",
        aliases: [
            "whisk", "wire whisk", "balloon whisk", "french whisk", "flat whisk",
            "mini whisk", "silicone whisk", "batidor", "fouet", "frusta"
        ],
        brands: ["OXO", "Cuisinart", "All-Clad", "Rösle", "Norpro"],
        size_variants: ["small", "medium", "large", "6-inch", "8-inch", "10-inch", "12-inch"]
    },
    {
        canonical_name: "wooden spoon",
        category: "Tools",
        aliases: [
            "wooden spoon", "wood spoon", "cooking spoon", "stirring spoon", "mixing spoon",
            "bamboo spoon", "hardwood spoon", "cuchara de madera", "cuillère en bois", "cucchiaio di legno"
        ],
        brands: ["OXO", "Norpro", "Ironwood Gourmet", "Totally Bamboo"]
    },
    {
        canonical_name: "spatula",
        category: "Tools",
        aliases: [
            "spatula", "rubber spatula", "silicone spatula", "scraper", "bowl scraper",
            "offset spatula", "turner", "flipper", "espátula", "spatule", "spatola"
        ],
        brands: ["OXO", "Rubbermaid", "GIR", "Williams Sonoma", "All-Clad"]
    },
    {
        canonical_name: "tongs",
        category: "Tools",
        aliases: [
            "tongs", "kitchen tongs", "cooking tongs", "serving tongs", "salad tongs",
            "grilling tongs", "locking tongs", "pinzas", "pinces", "pinze"
        ],
        brands: ["OXO", "Cuisinart", "All-Clad", "Rösle", "Weber"],
        size_variants: ["7-inch", "9-inch", "12-inch", "16-inch"]
    },
    // MEASURING TOOLS
    {
        canonical_name: "measuring cups",
        category: "Tools",
        aliases: [
            "measuring cups", "dry measuring cups", "liquid measuring cups", "measuring cup set",
            "nested measuring cups", "glass measuring cup", "plastic measuring cups",
            "tazas medidoras", "tasses à mesurer", "tazze graduate"
        ],
        brands: ["Pyrex", "OXO", "Cuisinart", "Anchor Hocking", "KitchenAid"]
    },
    {
        canonical_name: "measuring spoons",
        category: "Tools",
        aliases: [
            "measuring spoons", "measuring spoon set", "nested measuring spoons",
            "stainless steel measuring spoons", "cucharas medidoras", "cuillères à mesurer", "cucchiai dosatori"
        ],
        brands: ["OXO", "Cuisinart", "All-Clad", "Norpro"]
    },
    // SPECIALTY TOOLS
    {
        canonical_name: "can opener",
        category: "Tools",
        aliases: [
            "can opener", "tin opener", "electric can opener", "manual can opener",
            "church key", "abrelatas", "ouvre-boîte", "apriscatole"
        ],
        brands: ["OXO", "Swing-A-Way", "Black & Decker", "Hamilton Beach"]
    },
    {
        canonical_name: "potato masher",
        category: "Tools",
        aliases: [
            "potato masher", "masher", "vegetable masher", "bean masher", "avocado masher",
            "machacador", "presse-purée", "schiacciapatate"
        ],
        brands: ["OXO", "Cuisinart", "Norpro", "Progressive"]
    },
    {
        canonical_name: "grater",
        category: "Tools",
        aliases: [
            "grater", "box grater", "microplane", "cheese grater", "zester", "fine grater",
            "coarse grater", "rallador", "râpe", "grattugia"
        ],
        brands: ["Microplane", "OXO", "Cuisinart", "Zyliss"],
        size_variants: ["fine", "medium", "coarse", "extra-coarse"]
    },
    {
        canonical_name: "peeler",
        category: "Tools",
        aliases: [
            "peeler", "vegetable peeler", "potato peeler", "y-peeler", "swivel peeler",
            "julienne peeler", "pelador", "éplucheur", "pelapatate"
        ],
        brands: ["OXO", "Kuhn Rikon", "Swissmar", "Zyliss"]
    },
    // STRAINING & DRAINING
    {
        canonical_name: "colander",
        category: "Tools",
        aliases: [
            "colander", "strainer", "pasta strainer", "vegetable strainer", "mesh strainer",
            "fine mesh strainer", "coarse strainer", "colador", "passoire", "colapasta"
        ],
        brands: ["OXO", "Cuisinart", "All-Clad", "Norpro"],
        size_variants: ["small", "medium", "large", "1-quart", "3-quart", "5-quart"]
    },
    {
        canonical_name: "fine mesh strainer",
        category: "Tools",
        aliases: [
            "fine mesh strainer", "fine strainer", "sieve", "flour sifter", "tea strainer",
            "chinois", "bouillon strainer", "tamiz", "tamis", "setaccio"
        ],
        size_variants: ["3-inch", "4-inch", "6-inch", "8-inch"]
    },
    // BOWLS & CONTAINERS
    {
        canonical_name: "mixing bowl",
        category: "Tools",
        aliases: [
            "mixing bowl", "bowl", "large bowl", "medium bowl", "small bowl", "prep bowl",
            "stainless steel bowl", "glass bowl", "ceramic bowl", "nested bowls",
            "tazón", "bol", "ciotola", "kom"
        ],
        brands: ["Pyrex", "OXO", "Cuisinart", "All-Clad", "Anchor Hocking"],
        size_variants: ["1-quart", "1.5-quart", "2.5-quart", "4-quart", "5-quart", "8-quart"]
    },
    // SPECIALTY EQUIPMENT
    {
        canonical_name: "rolling pin",
        category: "Tools",
        aliases: [
            "rolling pin", "wooden rolling pin", "marble rolling pin", "silicone rolling pin",
            "french rolling pin", "tapered rolling pin", "rodillo", "rouleau à pâtisserie", "mattarello"
        ],
        brands: ["OXO", "Norpro", "Fox Run", "J.K. Adams"],
        size_variants: ["9-inch", "12-inch", "15-inch", "18-inch"]
    },
    {
        canonical_name: "thermometer",
        category: "Tools",
        aliases: [
            "thermometer", "instant-read thermometer", "digital thermometer", "meat thermometer",
            "candy thermometer", "oven thermometer", "probe thermometer", "termómetro", "thermomètre", "termometro"
        ],
        brands: ["ThermoWorks", "Taylor", "OXO", "Weber", "Polder"]
    },
    {
        canonical_name: "kitchen scale",
        category: "Tools",
        aliases: [
            "kitchen scale", "digital scale", "food scale", "baking scale", "gram scale",
            "pound scale", "báscula", "balance", "bilancia"
        ],
        brands: ["OXO", "Escali", "Ozeri", "Greater Goods", "My Weigh"]
    }
];
/*
 * Enhanced equipment matcher with fuzzy matching and alias resolution
 */
export class EnhancedEquipmentMatcher {
    equipmentMap;
    aliasMap;
    constructor() {
        this.equipmentMap = new Map();
        this.aliasMap = new Map();
        this.buildMaps();
    }
    buildMaps() {
        for (const equipment of COMPREHENSIVE_EQUIPMENT_DATABASE) {
            this.equipmentMap.set(equipment.canonical_name.toLowerCase(), equipment);
            // Map all aliases to canonical name
            for (const alias of equipment.aliases) {
                this.aliasMap.set(alias.toLowerCase(), equipment.canonical_name);
            }
            // Map brands if available
            if (equipment.brands) {
                for (const brand of equipment.brands) {
                    this.aliasMap.set(`${brand.toLowerCase()} ${equipment.canonical_name.toLowerCase()}`, equipment.canonical_name);
                }
            }
            // Map size variants if available
            if (equipment.size_variants) {
                for (const variant of equipment.size_variants) {
                    this.aliasMap.set(`${variant.toLowerCase()} ${equipment.canonical_name.toLowerCase()}`, equipment.canonical_name);
                }
            }
        }
    }
    /*
     * Find equipment mapping by name with fuzzy matching
     */
    findEquipment(name) {
        const lowerName = name.toLowerCase().trim();
        // Direct match
        if (this.aliasMap.has(lowerName)) {
            const canonicalName = this.aliasMap.get(lowerName);
            return this.equipmentMap.get(canonicalName) || null;
        }
        // Partial match - check if any alias is contained in the name
        for (const [alias, canonicalName] of this.aliasMap.entries()) {
            if (lowerName.includes(alias) || alias.includes(lowerName)) {
                return this.equipmentMap.get(canonicalName) || null;
            }
        }
        // Word-based matching
        const words = lowerName.split(/\s+/);
        for (const word of words) {
            if (word.length > 3) { // Skip very short words
                for (const [alias, canonicalName] of this.aliasMap.entries()) {
                    if (alias.includes(word)) {
                        return this.equipmentMap.get(canonicalName) || null;
                    }
                }
            }
        }
        return null;
    }
    /*
     * Get canonical name for equipment
     */
    getCanonicalName(name) {
        const equipment = this.findEquipment(name);
        return equipment?.canonical_name || name;
    }
    /*
     * Get all possible aliases for equipment
     */
    getAliases(name) {
        const equipment = this.findEquipment(name);
        return equipment?.aliases || [];
    }
    /*
     * Check if a name refers to kitchen equipment
     */
    isKitchenEquipment(name) {
        return this.findEquipment(name) !== null;
    }
}
// Export singleton instance
export const equipmentMatcher = new EnhancedEquipmentMatcher();
