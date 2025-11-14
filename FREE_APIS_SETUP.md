# 🆓 Free APIs & LLMs Setup Guide

This guide helps you set up **completely free** or **free-tier** APIs to enhance your recipe scraper without spending money.

## 📋 Table of Contents

1. [Free LLM APIs](#free-llm-apis)
2. [Free Nutrition APIs](#free-nutrition-apis)
3. [Free Recipe APIs](#free-recipe-apis)
4. [Environment Configuration](#environment-configuration)
5. [Usage Examples](#usage-examples)

---

## 🤖 Free LLM APIs

### 1. **Groq** (⭐ Recommended - Fastest)
**Free Tier**: High rate limits, extremely fast inference

**Setup**:
1. Visit: https://console.groq.com
2. Sign up for free account
3. Go to API Keys section
4. Create new API key

**Add to `.env`**:
```bash
GROQ_API_KEY=gsk_your_key_here
```

**Models Available**:
- `llama3-8b-8192` (Fast, 8K context)
- `mixtral-8x7b-32768` (Best quality, 32K context)
- `gemma-7b-it` (Efficient, 8K context)

**Rate Limits**: ~6000 tokens/minute (very generous!)

---

### 2. **Together AI**
**Free Tier**: $25 credits (no credit card required)

**Setup**:
1. Visit: https://together.ai
2. Sign up for free account
3. Get $25 free credits
4. Navigate to API Keys

**Add to `.env`**:
```bash
TOGETHER_API_KEY=your_key_here
```

**Models Available**:
- Llama-2-7B
- Mistral-7B-Instruct
- Mixtral-8x7B

**Credits**: $25 = ~25 million tokens

---

### 3. **Hugging Face**
**Free Tier**: 30,000 characters/month

**Setup**:
1. Visit: https://huggingface.co
2. Sign up for free account
3. Go to Settings > Access Tokens
4. Create new token (read access)

**Add to `.env`**:
```bash
HUGGINGFACE_API_KEY=hf_your_key_here
```

**Models Available**:
- Mistral-7B-Instruct
- Zephyr-7B-Beta
- FLAN-T5-XXL

**Limits**: 30k characters/month, model loading time ~20s

---

### 4. **Ollama** (⭐ Completely Free - Local)
**Free Tier**: Unlimited (runs locally)

**Setup**:
1. Download Ollama: https://ollama.ai
2. Install on your machine
3. Pull a model: `ollama pull llama2`
4. Run: `ollama serve` (starts on localhost:11434)

**Add to `.env`**:
```bash
USE_OLLAMA=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

**Models Available**:
- `llama2` (7B, 13B)
- `mistral` (7B)
- `phi` (2.7B - very fast)
- `codellama` (7B, 13B)

**Pros**: Unlimited usage, no API calls, privacy
**Cons**: Requires local compute resources

---

## 🥗 Free Nutrition APIs

### 1. **OpenFoodFacts** (⭐ Recommended - No API Key)
**Free Tier**: Unlimited, no API key required

**Setup**: No setup needed! Just use it.

**Add to `.env`**: Nothing needed!

**Database**: 2.8M+ products worldwide

**Example**:
```typescript
import { FreeAPIService } from './services/FreeAPIService';

const nutrition = await FreeAPIService.getNutrition({
  ingredientName: 'banana',
  quantity: 100,
  unit: 'g'
});
```

---

### 2. **Edamam Nutrition API**
**Free Tier**: 10 requests/min, 10,000 requests/month

**Setup**:
1. Visit: https://www.edamam.com
2. Sign up for Developer account
3. Choose Nutrition Analysis API
4. Get App ID and App Key

**Add to `.env`**:
```bash
EDAMAM_APP_ID=your_app_id
EDAMAM_APP_KEY=your_app_key
```

**Limits**: 10 req/min, 10k/month (plenty for most use cases)

---

### 3. **USDA FoodData Central**
**Free Tier**: 3,600 requests/hour

**Setup**:
1. Visit: https://fdc.nal.usda.gov/api-key-signup.html
2. Sign up for API key
3. Check email for key

**Add to `.env`**:
```bash
USDA_API_KEY=your_key_here
```

**Database**: 900k+ foods with detailed nutrition

**Limits**: 1000 requests/hour (very generous)

---

## 🍳 Free Recipe APIs

### 1. **TheMealDB** (⭐ No API Key Required)
**Free Tier**: 1 request per 5 seconds

**Setup**: No setup needed!

**Features**:
- Search recipes by ingredient
- Get recipe details
- Browse by category
- 650+ recipes

**Example**:
```typescript
const recipes = await FreeAPIService.searchRecipesByIngredient('chicken');
```

---

### 2. **Recipe Puppy** (No API Key Required)
**Free Tier**: Unlimited

**Setup**: No setup needed!

**Features**:
- Search recipes by ingredients
- 1M+ recipes
- Simple JSON API

**Example**:
```typescript
const recipes = await FreeAPIService.searchRecipes('pasta tomato');
```

---

### 3. **Spoonacular** (Free Tier Available)
**Free Tier**: 150 points/day (1 point = 1 request)

**Setup**:
1. Visit: https://spoonacular.com/food-api
2. Sign up for free account
3. Get API key

**Add to `.env`**:
```bash
SPOONACULAR_API_KEY=your_key_here
```

**Features**:
- Recipe search
- Ingredient analysis
- Meal planning
- 360k+ recipes

**Limits**: 150 requests/day

---

## ⚙️ Environment Configuration

### Complete `.env` Example

```bash
# ==================================
# FREE LLM APIS (Choose at least one)
# ==================================

# Groq (Recommended - Fastest)
GROQ_API_KEY=gsk_your_key_here

# Together AI (Good alternative)
TOGETHER_API_KEY=your_key_here

# Hugging Face (30k chars/month)
HUGGINGFACE_API_KEY=hf_your_key_here

# Ollama (Local - Unlimited)
USE_OLLAMA=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# ==================================
# FREE NUTRITION APIS
# ==================================

# OpenFoodFacts (No key needed - always used as fallback)

# Edamam (Optional - 10k/month)
EDAMAM_APP_ID=your_app_id
EDAMAM_APP_KEY=your_app_key

# USDA (Optional - 3600/hour)
USDA_API_KEY=your_key_here

# ==================================
# FREE RECIPE APIS
# ==================================

# TheMealDB & Recipe Puppy (No keys needed)

# Spoonacular (Optional - 150/day)
SPOONACULAR_API_KEY=your_key_here

# ==================================
# EXISTING CONFIGURATION
# ==================================

# Supabase (Required)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_key
SUPABASE_ANON_KEY=your_key

# Google APIs (Optional - for enhanced features)
GOOGLE_API_KEY=your_key
GOOGLE_VISION_API_KEY=your_key
```

---

## 💡 Usage Examples

### Example 1: Enhance Recipe with Free LLM

```typescript
import { FreeLLMService } from './services/FreeLLMService';

const enhanced = await FreeLLMService.enhanceRecipe({
  recipe: {
    title: 'Chocolate Chip Cookies',
    ingredients: ['flour', 'butter', 'chocolate chips'],
    instructions: ['Mix ingredients', 'Bake at 350F']
  },
  fields: ['description', 'tags', 'cuisines']
});

console.log(enhanced.data);
// {
//   description: "Classic homemade chocolate chip cookies...",
//   tags: ["dessert", "baking", "comfort-food", "family-friendly"],
//   cuisines: ["American"]
// }
```

### Example 2: Get Nutrition Data from Free APIs

```typescript
import { FreeAPIService } from './services/FreeAPIService';

const nutrition = await FreeAPIService.getNutrition({
  ingredientName: 'chicken breast',
  quantity: 150,
  unit: 'g'
});

console.log(nutrition.data);
// {
//   calories: 165,
//   protein_g: 31,
//   carbs_g: 0,
//   fat_g: 3.6,
//   fiber_g: 0,
//   sugar_g: 0,
//   sodium_mg: 74
// }
```

### Example 3: Test All Configured APIs

```typescript
import { FreeLLMService } from './services/FreeLLMService';
import { FreeAPIService } from './services/FreeAPIService';

// Test LLMs
const llmProviders = FreeLLMService.getAvailableProviders();
console.log('Available LLM providers:', llmProviders);

const llmTests = await FreeLLMService.testProviders();
console.log('LLM test results:', llmTests);

// Test APIs
const apiTests = await FreeAPIService.testAPIs();
console.log('API test results:', apiTests);
```

---

## 🎯 Recommended Setup for Maximum Free Coverage

### Minimum Setup (No API Keys Required)
```bash
# Just these 3 free services, no keys needed!
USE_OLLAMA=true                    # Free local LLM
# OpenFoodFacts automatic          # Free nutrition data
# TheMealDB automatic              # Free recipe search
```

### Recommended Setup (Still 100% Free)
```bash
# Best free LLM
GROQ_API_KEY=gsk_xxx               # Fastest free LLM

# Best free nutrition
USDA_API_KEY=xxx                   # Most comprehensive

# Existing required
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Maximum Coverage (All Free Tiers)
```bash
# All free LLMs
GROQ_API_KEY=gsk_xxx
TOGETHER_API_KEY=xxx               # $25 free credits
HUGGINGFACE_API_KEY=hf_xxx
USE_OLLAMA=true

# All free nutrition APIs
EDAMAM_APP_ID=xxx
EDAMAM_APP_KEY=xxx
USDA_API_KEY=xxx

# All free recipe APIs
SPOONACULAR_API_KEY=xxx
```

---

## 📊 Comparison: Free vs Paid APIs

| Feature | Free Option | Paid Option | Savings |
|---------|------------|-------------|---------|
| LLM Enhancement | Groq (Free) | OpenAI GPT-4 ($0.03/1K tokens) | $50-200/month |
| Nutrition Data | OpenFoodFacts (Free) | Nutritionix ($50/month) | $50/month |
| Recipe Search | TheMealDB (Free) | Spoonacular Pro ($150/month) | $150/month |
| **Total Savings** | - | - | **$250-400/month** |

---

## 🚀 Quick Start

1. **Install Ollama** (5 minutes)
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   ollama pull llama2
   ollama serve
   ```

2. **Get Groq API Key** (2 minutes)
   - Visit https://console.groq.com
   - Sign up, create API key
   - Add to `.env`: `GROQ_API_KEY=gsk_xxx`

3. **Get USDA API Key** (2 minutes)
   - Visit https://fdc.nal.usda.gov/api-key-signup.html
   - Sign up, check email
   - Add to `.env`: `USDA_API_KEY=xxx`

4. **Test Setup**
   ```bash
   npx tsx src/test-free-apis.ts
   ```

---

## 🎉 You're All Set!

You now have access to:
- ✅ 4 free LLM providers (Groq, Together, HF, Ollama)
- ✅ 3 free nutrition APIs (OpenFoodFacts, Edamam, USDA)
- ✅ 3 free recipe APIs (TheMealDB, Recipe Puppy, Spoonacular)

**Total monthly cost: $0** 🎊

---

## 🆘 Troubleshooting

### Issue: "Groq API rate limit exceeded"
**Solution**: The service automatically falls back to Together AI, then Hugging Face, then Ollama

### Issue: "Ollama connection refused"
**Solution**: Run `ollama serve` to start the Ollama server

### Issue: "No nutrition data found"
**Solution**: Try a different ingredient name or use generic terms (e.g., "chicken" instead of "organic free-range chicken")

### Issue: "All providers failed"
**Solution**: Check your API keys in `.env` and run the test script to verify configuration

---

## 📚 Additional Resources

- [Groq Documentation](https://console.groq.com/docs)
- [Ollama Models](https://ollama.ai/library)
- [OpenFoodFacts API](https://wiki.openfoodfacts.org/API)
- [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide.html)
- [Edamam API Docs](https://developer.edamam.com/edamam-docs-nutrition-api)

---

**Happy Scraping! 🍳**
