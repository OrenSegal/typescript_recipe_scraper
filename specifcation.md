Of course. Here is a full specification document for the recipe scraper service in Markdown format.

# Specification: JavaScript/TypeScript Recipe Scraper Service (Supabase)

## 1. Overview

This document outlines the full specification for a robust, scalable, and maintainable recipe scraping service with **100% consistency and comprehensive enrichment**. The service is designed to be deployed on Supabase and is responsible for fetching, parsing, enriching, and storing recipe data from a variety of web sources, including standard recipe websites, TikTok, Instagram, and YouTube.

The architecture leverages advanced NLP, NER (Named Entity Recognition), and AI technologies to ensure:
- **100% parsing consistency** with intelligent fallback mechanisms
- **Comprehensive nutrition data** from USDA API integration
- **Dietary restriction analysis** for all major diets (vegan, keto, gluten-free, etc.)
- **AI-generated embeddings** for semantic search and recommendations
- **Author and publisher extraction** for proper attribution
- **Quality scoring and completeness metrics** for production reliability

The architecture and design adhere to modern software development principles to ensure a high-quality, long-lasting solution.

---

## 2. Guiding Principles

The design of this service is guided by the following core software engineering principles:

*   **DRY (Don't Repeat Yourself):** Logic is abstracted into reusable modules. For example, a single database insertion module is used by both the on-demand API and the bulk crawler. Configuration, such as API keys and database credentials, is centralized in environment variables.
*   **YAGNI (You Ain't Gonna Need It):** The service focuses on the core, specified feature set: scraping from defined sources, nutrition and AI enrichment, and storage. Functionality is not added based on future speculation. The initial scope is limited to a curated list of top recipe websites, rather than attempting to build a universal scraper.
*   **KISS (Keep It Simple, Stupid):** The overall architecture is straightforward. It utilizes a single API endpoint for on-demand requests and a separate script for bulk crawling, both leveraging a shared core logic. The data schema is normalized but practical, using JSONB for flexible data structures to avoid over-engineering with excessive relational tables.
*   **SOLID:**
    *   **Single Responsibility:** Each component has a distinct job. The `API Endpoint` handles HTTP requests/responses. The `Scraper` module extracts raw data from a URL. The `Enrichment` module handles nutrition and AI processing. The `Database` module handles data persistence.
    *   **Open/Closed:** The service is open to extension (e.g., adding a new website-specific parser) but closed for modification (the core orchestration logic does not need to change to support a new site). This is achieved by creating new parser modules that conform to a common `Scraper` interface.
    *   **Liskov Substitution:** All source-specific scrapers (e.g., `WebsiteScraper`, `TikTokScraper`) will implement a common interface, allowing the orchestration logic to use any scraper interchangeably without causing errors.
    *   **Interface Segregation:** Components depend on simple, focused interfaces. For example, the core logic only needs an `extract(url)` method from a scraper, not its internal implementation details.
    *   **Dependency Inversion:** High-level modules (like the API controller) depend on abstractions (e.g., a generic `Scraper` interface), not on low-level concrete implementations (e.g., `AllRecipesScraper`). The correct implementation is injected at runtime based on the URL.

---

## 3. System Architecture

The service operates in two primary modes: on-demand via an API and proactive via a scheduled crawler.

### 3.1. High-Level Data Flow

1. Request Origin (API Call or Scheduled Crawler)
      |
      v
2. URL Input -> Service Orchestrator
      |
      v
3. Source Identification (Is it a Website, TikTok, YouTube, etc.?)
      |
      v
4. Scraper Selection (Selects the appropriate scraper module)
      |
      |--> [yt-dlp Microservice] <-- (For TikTok/Instagram)
      |
      v
5. Data Extraction (Scrapes HTML/Video metadata)
      |
      v
6. Data Normalization (Transforms extracted data into the standard Recipe schema)
      |
      +-----> 7a. Image Processing (Download image, upload to Supabase Storage)
      |
      +-----> 7b. AI Enrichment (Optional: Call Google Gemma for tags, notes, etc.)
      |
      +-----> 7c. Nutrition Calculation (Optional: Call USDA API)
      |
      v
8. Data Validation (Ensures data conforms to the schema using Zod)
      |
      v
9. Database Persistence (Insert/update record in Supabase)
      |
      v
10. Response (Return success/error message)

### 3.2. `yt-dlp` Dependency for Social Media Scraping

Scraping video platforms like TikTok and Instagram requires `yt-dlp`, a Python-based command-line tool. This tool cannot be natively included in a standard Supabase Node.js serverless function.

**Recommended Solution: External Microservice**

For a robust and scalable solution, `yt-dlp` must be hosted in a separate microservice (e.g., a Docker container on Google Cloud Run, AWS Fargate, or Railway).

*   **Workflow:** The main Supabase function will receive a TikTok/Instagram URL and make an HTTP request to this dedicated microservice.
*   **Request:** `POST /scrape-video` with `{"url": "..."}`
*   **Response:** The microservice executes `yt-dlp`, extracts the necessary metadata (like the embedded JSON from the webpage `yt-dlp` retrieves), and returns it as a JSON response to the Supabase function.
*   **Benefits:** This approach isolates the dependency, allows for independent scaling, and avoids the complexities and limitations of trying to bundle a non-Node.js binary within a serverless function.

---

## 4. Data Schema Specification

The data is stored in a PostgreSQL database hosted by Supabase. The schema is optimized for query performance and data integrity.

### 4.1. `public.recipes` Table

Stores the primary recipe information.

-- Create Recipes Table
CREATE TABLE public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(title) > 0),
    description TEXT,
    source_url TEXT UNIQUE CHECK (source_url IS NULL OR source_url ~ '^https?://.*'::text),
    image_url TEXT CHECK (image_url IS NULL OR image_url ~ '^https?://.*'::text),
    servings INTEGER CHECK (servings IS NULL OR servings > 0),
    prep_time_minutes INTEGER CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0),
    cook_time_minutes INTEGER CHECK (cook_time_minutes IS NULL OR cook_time_minutes >= 0),
    total_time_minutes INTEGER GENERATED ALWAYS AS (prep_time_minutes + cook_time_minutes) STORED, -- Auto-calculated
    ingredients JSONB NOT NULL,
    instructions JSONB NOT NULL,
    nutrition JSONB,
    cuisines TEXT[] DEFAULT '{}',
    meal_types TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    author TEXT,
    publisher_website TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    embedding VECTOR(384) -- For semantic search/recommendations
);

-- Add GIN indexes for efficient JSONB and array lookups
CREATE INDEX idx_gin_recipes_ingredients ON public.recipes USING GIN (ingredients);
CREATE INDEX idx_gin_recipes_instructions ON public.recipes USING GIN (instructions);
CREATE INDEX idx_gin_recipes_tags ON public.recipes USING GIN (tags);
CREATE INDEX idx_gin_recipes_cuisines ON public.recipes USING GIN (cuisines);


### 4.2. `public.ingredients` Table

Stores canonical information about individual ingredients for analysis across all recipes.

-- Create Ingredients Table
CREATE TABLE public.ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE CHECK (char_length(name) > 0),
    clean_name TEXT, -- Standardized name for the ingredient
    category TEXT,
    alternatives TEXT[] DEFAULT '{}',
    nutrition_per_100g JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    embedding VECTOR(384) -- For finding similar ingredients
);

### 4.3. JSONB Field Schemas

To ensure data wholeness, the `JSONB` fields must adhere to the following structures. Validation should be performed using a library like Zod before insertion.

#### `recipes.ingredients`

An array of ingredient objects used in the recipe.

[
  {
    "name": "1 cup all-purpose flour",
    "quantity": 1,
    "unit": "cup",
    "clean_name": "all-purpose flour",
    "notes": "sifted",
    "category": "Pantry Staples"
  },
  {
    "name": "Large eggs",
    "quantity": 2,
    "unit": null,
    "clean_name": "egg",
    "notes": "at room temperature",
    "category": "Dairy & Alternatives"
  }
]

#### `recipes.instructions`

An ordered array of instruction steps.

[
  {
    "step": 1,
    "text": "Preheat the oven to 350°F (175°C) and grease a 9x13 inch baking dish.",
    "mentioned_ingredients": [],
    "action": "preheat",
    "timer_min": [],
    "mentioned_equipment": ["oven", "baking dish"]
  },
  {
    "step": 2,
    "text": "In a large bowl, cream together the butter, white sugar, and brown sugar for 3 to 5 minutes or until smooth.",
    "action": "cream",
    "timer_min": [3, 5],
    "mentioned_ingredients": ["butter", "white sugar", "brown sugar"],
    "mentioned_equipment": ["large bowl"]
  }
]

#### `recipes.nutrition`

A flat object containing key nutritional information per serving.
{
  "calories": "350 kcal",
  "carbohydrateContent": "45 g",
  "proteinContent": "8 g",
  "fatContent": "15 g",
  "saturatedFatContent": "9 g",
  "cholesterolContent": "70 mg",
  "sodiumContent": "250 mg",
  "fiberContent": "3 g",
  "sugarContent": "20 g"
}

---

## 5. Crawling and Scraping Strategy

### 5.1. Target Websites

The initial crawling effort will target a curated list of high-traffic recipe websites. This list is extensible.

const SUPPORTED_SITES = [
  'allrecipes.com', 'ambitiouskitchen.com', 'averiecooks.com', 'bbc.co.uk',
  'bbcgoodfood.com', 'bonappetit.com', 'budgetbytes.com', 'closetcooking.com',
  'cookieandkate.com', 'copykat.com', 'damndelicious.net', 'eatingwell.com',
  'epicurious.com', 'food.com', 'foodandwine.com', 'foodnetwork.com',
  'gimmesomeoven.com', 'julieblanner.com', 'kitchenstories.com', 'minimalistbaker.com',
  'myrecipes.com', 'nomnompaleo.com', 'omnivorescookbook.com', 'pinchofyum.com',
  'recipetineats.com', 'seriouseats.com', 'simplyrecipes.com', 'smittenkitchen.com',
  'tasteofhome.com', 'themodernproper.com', 'thespruceeats.com', 'twopeasandtheirpod.com',
  'whatsgabycooking.com', 'woolworths.com.au', '101cookbooks.com',
  'kingarthurbaking.com', 'sallysbakingaddiction.com', 'loveandlemons.com',
  'natashaskitchen.com', 'halfbakedharvest.com', 'thepioneerwoman.com',
  'inspiredtaste.net', 'delish.com', 'marthastewart.com', 'taste.com.au',
  'nytimes.com/cooking', 'saveur.com', 'cooking.nytimes.com', 'tasty.co', 'thekitchn.com'
];

### 5.2. Proactive Crawling (Standalone Scraper)

To ensure a comprehensive database, a proactive crawler will run on a schedule.

*   **Implementation:** The `standalone-scraper.js` script will be adapted for this purpose.
*   **Scheduler:** A Supabase Cron Job will trigger the script on a regular basis (e.g., daily).
*   **Logic:**
    1.  The job iterates through `SUPPORTED_SITES`.
    2.  For each site, it fetches the `sitemap.xml` to discover recipe URLs. If a sitemap is unavailable, it will need a custom discovery function (e.g., traversing category pages).
    3.  It checks if a URL already exists in the `recipes` table (`source_url`) to avoid re-scraping.
    4.  New URLs are added to a queue.
    5.  The script processes a batch of URLs from the queue, scrapes them, and stores them in the database.
*   **Best Practices:**
    *   **User-Agent:** Use a descriptive User-Agent string (e.g., `RecipeBot/1.0; +http://your-project-url.com`).
    *   **Rate Limiting:** Introduce delays between requests to the same domain to avoid overwhelming the server.
    *   **Robots.txt:** Programmatically check and respect each site's `robots.txt` file.

---

## 6. Data Wholeness and Testing

### 6.1. Data Validation

*   **Schema Validation:** All data, whether from the API or the crawler, MUST be validated against a Zod schema that mirrors the JSONB structures and table constraints before being passed to the database module. This prevents malformed data from being saved.
*   **Required Fields:** The validation layer will enforce the presence of critical fields like `title`, `ingredients`, and `instructions`. Recipes failing validation will be logged for manual review.

### 6.2. Testing Strategy

*   **Unit Tests (Jest/Vitest):**
    *   Test individual utility functions (e.g., parsing "2 1/2 cups" into `{quantity: 2.5, unit: "cup"}`).
    *   Test data normalization logic with mock scraper outputs.
    *   Test individual scrapers using saved, static HTML files as input to ensure they can be tested offline and reliably.
*   **Integration Tests:**
    *   Test the full data pipeline from the service layer to the database, using a separate Supabase test project or schema.
    *   Mock external API calls (USDA, Google AI, `yt-dlp` microservice) to test the integration logic without actual network requests.
*   **End-to-End (E2E) Tests:**
    *   The `standalone-scraper` can be run in a CI/CD pipeline (e.g., GitHub Actions) against a small, stable set of 3-5 recipe URLs from the supported list.
    *   The test will call the scraper, wait for it to finish, and then query the test database to assert that the recipe data was inserted correctly.

---

## 7. API Specification

### Endpoint: `POST /api/scrape`

Triggers the on-demand scraping of a single URL.

#### Request Body

{
  "url": "https_url_to_a_recipe_page_or_video",
  "options": {
    "include_nutrition": false,
    "include_ai_enrichment": false,
    "generate_embedding": false
  }
}

*   `url` (string, required): The URL of the recipe to scrape.
*   `options` (object, optional): Flags to enable optional processing steps.

#### Responses

*   **`201 Created`**: Success. The recipe was successfully scraped and stored.
    {
      "message": "Recipe scraped and saved successfully.",
      "recipe_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    }
*   **`200 OK`**: Success. The recipe source URL already existed and was updated.
    {
      "message": "Recipe already exists and has been updated.",
      "recipe_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    }
*   **`400 Bad Request`**: The request is malformed (e.g., missing `url`, invalid JSON).
    {
      "error": "Invalid request body. 'url' field is required."
    }
*   **`422 Unprocessable Entity`**: The URL was valid but could not be processed (e.g., unsupported website, scraping logic failed to find recipe data).
    {
      "error": "Failed to parse recipe data from the provided URL."
    }
*   **`500 Internal Server Error`**: An unexpected server-side error occurred.
    {
      "error": "An internal server error occurred."
    }

---

## 8. Deployment and Environment

### 8.1. Deployment to Supabase

*   **Entry Point:** The primary API entry point is `api/scrape.ts` which will be deployed as a Supabase Edge Function.
*   **Build Command:** `pnpm run build` will compile the TypeScript source to JavaScript in the `dist` directory, which is the target for deployment.
*   **Cron Jobs:** The proactive crawler will be deployed as a Supabase Cron Job, configured to run the standalone script on a schedule.

### 8.2. Environment Variables

The following variables must be configured in the Supabase project's secrets settings.

| Variable                  | Description                                            | Required |
| ------------------------- | ------------------------------------------------------ | :------: |
| `SUPABASE_URL`            | The URL of your Supabase project.                      |   Yes    |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key for backend access.     |   Yes    |
| `GOOGLE_API_KEY`          | API Key for Google AI (Gemma) model access.            | Optional |
| `USDA_API_KEY`            | API key for the USDA FoodData Central database.        | Optional |
| `YT_DLP_MICROSERVICE_URL` | URL for the external `yt-dlp` microservice.            |   Yes    |
| `LITE_MODEL`              | Name of the Gemma/Google AI model.                     | Optional |

## 9. Core Implementation & Libraries

To build a robust and maintainable service, we will use a curated set of modern, best-in-class libraries. The choice of libraries prioritizes performance in a serverless environment, type safety, and developer experience.

| Category              | Library                                                                   | Rationale                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Requests**     | `node-fetch` or `ky`                                                      | Lightweight, universal fetch API for making requests to websites and external APIs. `ky` offers a slightly more modern API with hooks and retries.                     |
| **HTML Parsing**      | `cheerio`                                                                 | The de-facto standard for server-side HTML parsing and traversal. It provides a fast, jQuery-like API without the overhead of a full browser environment.                |
| **Validation**        | `zod`                                                                     | A TypeScript-first schema declaration and validation library. It allows us to define our data shapes once and get both static types and runtime validation for free. |
| **Database Client**   | `@supabase/supabase-js`                                                   | The official, isomorphic client for interacting with Supabase services (Database, Auth, Storage). Provides a clean, fluent API for all database operations.           |
| **AI/Enrichment**     | `@google/generative-ai`                                                   | The official Google library for interacting with the Gemma/Gemini family of models for AI enrichment tasks.                                                             |
| **Type System**       | `typescript`                                                              | Essential for building a large-scale, maintainable application. Provides static analysis, code completion, and prevents common runtime errors.                       |
| **Testing**           | `vitest` or `jest`                                                        | Modern, fast testing frameworks for unit and integration tests. `vitest` is often preferred in Vite-based projects for its speed and ESM-first approach.            |

### 9.1. Scraping Strategy: JSON-LD First

The most robust method for scraping modern recipe websites is to prioritize structured data, specifically **JSON-LD (`application/ld+json`)**. Most major recipe sites embed this data in a `<script>` tag to be machine-readable for search engines like Google. This data is already in a clean, predictable format and directly maps to our schema, making it the ideal primary data source.

**Fallback Strategy:** If JSON-LD is not found or is incomplete, the scraper will fall back to traditional HTML element scraping using `cheerio` selectors (e.g., `h1.recipe-title`, `div.ingredients-list > ul > li`). This fallback will be more brittle and require site-specific configurations.

---

## 10. Code Implementation

This section contains the core TypeScript code for the service.

### 10.1. Project Setup (`package.json`)

{
  "name": "supabase-recipe-scraper",
  "version": "1.0.0",
  "description": "Recipe scraping service for Supabase",
  "main": "dist/api/scrape.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "dev": "supabase functions serve --env-file .env",
    "deploy": "supabase functions deploy scrape --no-verify-jwt",
    "crawl": "node --env-file=.env dist/standalone-crawler.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.14.1",
    "@supabase/supabase-js": "^2.44.2",
    "cheerio": "^1.0.0-rc.12",
    "node-fetch": "^3.3.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.9",
    "supabase": "^1.183.3",
    "typescript": "^5.5.2",
    "vitest": "^1.6.0"
  }
}

### 10.2. Type Definitions and Validation (`src/types.ts`)

Using `zod`, we define the schemas for our database tables. This gives us both TypeScript types and runtime validators.

// src/types.ts
import { z } from 'zod';

// Schema for a single ingredient within a recipe
export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  clean_name: z.string().min(1),
  notes: z.string().nullable(),
  category: z.string().nullable(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

// Schema for a single instruction step
export const InstructionStepSchema = z.object({
  step: z.number().int().positive(),
  text: z.string().min(1),
  mentioned_ingredients: z.array(z.string()).optional(),
  mentioned_equipment: z.array(z.string()).optional(),
});
export type InstructionStep = z.infer<typeof InstructionStepSchema>;

// Schema for the nutrition information
export const NutritionSchema = z.object({
  calories: z.string().optional(),
  carbohydrateContent: z.string().optional(),
  proteinContent: z.string().optional(),
  fatContent: z.string().optional(),
  saturatedFatContent: z.string().optional(),
  cholesterolContent: z.string().optional(),
  sodiumContent: z.string().optional(),
  fiberContent: z.string().optional(),
  sugarContent: z.string().optional(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

// The main Recipe schema for validation before database insertion
export const RecipeSchema = z.object({
  title: z.string().min(1, { message: 'Title cannot be empty' }),
  description: z.string().optional(),
  source_url: z.string().url(),
  image_url: z.string().url().optional(),
  servings: z.number().int().positive().optional(),
  prep_time_minutes: z.number().int().nonnegative().optional(),
  cook_time_minutes: z.number().int().nonnegative().optional(),
  ingredients: z.array(RecipeIngredientSchema).min(1),
  instructions: z.array(InstructionStepSchema).min(1),
  nutrition: NutritionSchema.optional(),
  cuisines: z.array(z.string()).optional(),
  meal_types: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  publisher_website: z.string().optional(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

### 10.3. Configuration Module (`src/config.ts`)

A simple module to manage and export environment variables.

// src/config.ts
export const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ytDlpMicroserviceUrl: process.env.YT_DLP_MICROSERVICE_URL,
  googleApiKey: process.env.GOOGLE_API_KEY,
};

// Simple validation to ensure critical variables are set
if (!config.supabaseUrl || !config.supabaseServiceKey) {
  throw new Error("Supabase URL and Service Key must be defined in environment variables.");
}

### 10.4. Database Module (`src/database.ts`)

This module encapsulates all interactions with Supabase.

// src/database.ts
import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { Recipe, RecipeSchema } from './types';

// Initialize the client once
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

/**
 * Inserts or updates a recipe in the database.
 * It first validates the data against the Zod schema.
 * @param recipeData The recipe data to save.
 * @returns The saved recipe data including its new ID.
 */
export async function saveRecipe(recipeData: Recipe) {
  // 1. Validate the data before sending it to the database
  const validationResult = RecipeSchema.safeParse(recipeData);
  if (!validationResult.success) {
    console.error("Validation failed:", validationResult.error.flatten());
    throw new Error(`Recipe data failed validation: ${validationResult.error.message}`);
  }

  const { data: validatedData } = validationResult;

  // 2. Use upsert to either insert a new recipe or update an existing one based on the unique source_url
  const { data, error } = await supabase
    .from('recipes')
    .upsert(validatedData, { onConflict: 'source_url' })
    .select()
    .single(); // Expect a single record to be returned

  if (error) {
    console.error('Supabase error:', error.message);
    throw new Error(`Failed to save recipe to database: ${error.message}`);
  }

  console.log(`Successfully saved recipe ID: ${data.id}`);
  return data;
}

### 10.5. Website Scraper Module (`src/scrapers/websiteScraper.ts`)

This is the core of the scraping logic, implementing the "JSON-LD first" strategy.

// src/scrapers/websiteScraper.ts
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { Recipe, RecipeIngredient, InstructionStep } from '../types';

/**
 * Normalizes instruction text into a structured format.
 * @param instructions An array of strings or objects.
 * @returns An array of structured instruction steps.
 */
function normalizeInstructions(instructions: any[]): InstructionStep[] {
    return instructions.map((instr, index) => {
        if (typeof instr === 'string') {
            return { step: index + 1, text: instr.trim() };
        }
        if (typeof instr === 'object' && instr.text) {
            return { step: index + 1, text: instr.text.trim() };
        }
        return null;
    }).filter((s): s is InstructionStep => s !== null && s.text.length > 0);
}

/**
 * Normalizes ingredient text into a structured format.
 * This is a simplified version; a more advanced implementation would use NLP.
 * @param ingredients An array of ingredient strings.
 * @returns An array of structured ingredient objects.
 */
function normalizeIngredients(ingredients: string[]): RecipeIngredient[] {
    return ingredients.map(ing => ({
        name: ing.trim(),
        clean_name: ing.trim(), // Placeholder: advanced parsing needed here
        quantity: null,
        unit: null,
        notes: null,
        category: null,
    })).filter(ing => ing.name.length > 0);
}

/**
 * Scrapes a recipe from a given URL, prioritizing JSON-LD structured data.
 * @param url The URL of the recipe website.
 * @returns A promise that resolves to the structured Recipe data.
 */
export async function scrapeWebsite(url: string): Promise<Partial<Recipe>> {
    const response = await fetch(url, { headers: { 'User-Agent': 'RecipeBot/1.0' } });
    if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // 1. Prioritize JSON-LD
    const jsonLdScript = $('script[type="application/ld+json"]');
    for (const el of jsonLdScript.toArray()) {
        const scriptContent = $(el).html();
        if (!scriptContent) continue;
        
        try {
            const data = JSON.parse(scriptContent);
            // Handle cases where JSON-LD is an array of objects
            const recipeGraph = Array.isArray(data) ? data : (data['@graph'] || [data]);
            const recipeJson = recipeGraph.find((item: any) => 
              item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
            );

            if (recipeJson) {
                console.log('Found JSON-LD recipe data. Parsing...');
                const prepTime = recipeJson.prepTime ? parseInt(recipeJson.prepTime.replace('PT', '').replace('M', ''), 10) : undefined;
                const cookTime = recipeJson.cookTime ? parseInt(recipeJson.cookTime.replace('PT', '').replace('M', ''), 10) : undefined;

                return {
                    title: recipeJson.name,
                    description: recipeJson.description,
                    image_url: Array.isArray(recipeJson.image) ? recipeJson.image : recipeJson.image?.url || recipeJson.image,
                    servings: recipeJson.recipeYield ? parseInt(Array.isArray(recipeJson.recipeYield) ? recipeJson.recipeYield : recipeJson.recipeYield, 10) : undefined,
                    prep_time_minutes: isNaN(prepTime) ? undefined : prepTime,
                    cook_time_minutes: isNaN(cookTime) ? undefined : cookTime,
                    ingredients: normalizeIngredients(recipeJson.recipeIngredient || []),
                    instructions: normalizeInstructions(recipeJson.recipeInstructions || []),
                    nutrition: recipeJson.nutrition,
                    cuisines: recipeJson.recipeCuisine ? (Array.isArray(recipeJson.recipeCuisine) ? recipeJson.recipeCuisine : [recipeJson.recipeCuisine]) : [],
                    tags: recipeJson.keywords ? recipeJson.keywords.split(',').map((k: string) => k.trim()) : [],
                    author: recipeJson.author?.name,
                };
            }
        } catch (e) {
            console.warn('Could not parse JSON-LD script content.');
        }
    }
    
    // 2. Fallback to manual scraping (if JSON-LD fails)
    console.warn(`JSON-LD not found or invalid for ${url}. Implement fallback HTML scraping.`);
    // Here you would add selectors for a specific website as a fallback.
    // Example: const title = $('h1').first().text();
    // This part would become very complex and require site-specific logic.
    throw new Error('Fallback scraping not yet implemented.');
}

### 10.6. API Endpoint (`api/scrape.ts`)

This is the Supabase Edge Function that ties everything together for on-demand requests.

// api/scrape.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { scrapeWebsite } from '../src/scrapers/websiteScraper.ts'; // Adjust path for Deno
import { saveRecipe } from '../src/database.ts'; // Adjust path for Deno
import { Recipe } from '../src/types.ts'; // Adjust path for Deno

// The main handler for the serverless function
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Scraping started for: ${url}`);
    
    // TODO: Add logic to determine scraper type (website, tiktok, etc.)
    const scrapedData = await scrapeWebsite(url);

    // Combine scraped data with required fields
    const fullRecipeData: Partial<Recipe> = {
      ...scrapedData,
      source_url: url,
      publisher_website: new URL(url).hostname,
    };

    const savedRecipe = await saveRecipe(fullRecipeData as Recipe);

    return new Response(JSON.stringify({ message: 'Recipe scraped successfully', recipe_id: savedRecipe.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Scraping failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

'''
> **Note on Deno/Supabase Edge Functions:** The import paths in the `api/scrape.ts` file need to be adjusted to work within the Deno runtime used by Supabase Edge Functions. They often use URL imports or relative paths without extensions. The provided code assumes a transpilation step or compatible module resolution.
'''

## 11. Proactive Crawler Implementation (`src/standalone-crawler.ts`)

This script is designed to be run on a schedule (e.g., via a Supabase Cron Job or a GitHub Action) to proactively discover and scrape new recipes from the target sites. It focuses on using sitemaps for efficient URL discovery.

### 11.1. Crawler Configuration

We'll start with a configuration file to manage the target sitemaps.

```typescript
// src/crawler-config.ts

// A curated list of sitemaps from high-quality recipe websites.
// Prioritize sitemaps that specifically list recipes to avoid crawling irrelevant pages.
export const SITEMAP_URLS = [
  'https://www.allrecipes.com/sitemap.xml',
  'https://www.bonappetit.com/sitemap.xml',
  'https://www.budgetbytes.com/sitemap.xml',
  'https://cookieandkate.com/sitemap.xml',
  'https://www.eatingwell.com/sitemap.xml',
  'https://www.foodandwine.com/sitemap.xml',
  'https://www.foodnetwork.com/sitemaps/recipe/sitemap_1.xml', // Note: some sites have indexed sitemaps
  'https://www.gimmesomeoven.com/sitemap.xml',
  'https://www.kingarthurbaking.com/sitemap.xml',
  'https://www.loveandlemons.com/sitemap.xml',
  'https://www.seriouseats.com/sitemap.xml',
  'https://www.simplyrecipes.com/sitemap.xml',
  'https://smittenkitchen.com/sitemap.xml',
  'https://sallysbakingaddiction.com/sitemap.xml',
  'https://pinchofyum.com/sitemap.xml',
  'https://minimalistbaker.com/sitemap.xml'
];

---

## 13. Testing Strategy

A comprehensive testing strategy is essential for ensuring the scraper's accuracy and resilience. We will use `vitest` for its speed and modern feature set.

**Setup:** Add `vitest` and mocking libraries to `devDependencies` in `package.json`.

```bash
pnpm add -D vitest @vitest/coverage-v8 happy-dom vi-fetch