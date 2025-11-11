import { Router, Request, Response } from 'express';
import { UnifiedScraper } from '../../scrapers/UnifiedScraper.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { ComprehensiveEnrichment } from '../../enrichment/comprehensiveEnrichment.js';

const router = Router();

/**
 * POST /api/recipes/scrape
 * Scrape a single recipe from URL
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { url, enrich = true, save = true } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Missing required parameter: url',
        timestamp: new Date().toISOString()
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
        timestamp: new Date().toISOString()
      });
    }

    const scraper = new UnifiedScraper();
    const scrapingResult = await scraper.scrapeRecipe(url);

    if (!scrapingResult.success || !scrapingResult.recipe) {
      return res.status(404).json({
        error: 'No recipe data found at the provided URL',
        url,
        timestamp: new Date().toISOString()
      });
    }

    // Extract recipe data from scraping result
    const recipeData = scrapingResult.recipe;

    // AI Enrichment
    try {
      const enrichedData = await ComprehensiveEnrichment.enrichRecipe(recipeData);
      Object.assign(recipeData, enrichedData);
    } catch (enrichError) {
      console.warn('Recipe enrichment failed:', enrichError);
      // Continue without enrichment
    }

    // Save to database (cast to ParsedRecipeData for now)
    let savedRecipe = null;
    if (save) {
      try {
        const db = DatabaseService.getInstance();
        await db.initialize();
        savedRecipe = await db.saveRecipe(recipeData as any);
      } catch (saveError) {
        console.warn('Database save failed:', saveError);
        // Continue without saving
      }
    }

    res.json({
      success: true,
      recipe: recipeData,
      savedId: savedRecipe?.id || null,
      enriched: enrich,
      saved: save && !!savedRecipe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recipe scraping error:', error);
    res.status(500).json({
      error: 'Failed to scrape recipe',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/recipes/export
 * Export all recipes from database
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'json', limit } = req.query;

    const db = DatabaseService.getInstance();
    let recipes = await db.getAllRecipes();

    // Apply limit if specified
    if (limit && !isNaN(Number(limit))) {
      recipes = recipes.slice(0, Number(limit));
    }

    switch (format) {
      case 'csv':
        const csvContent = await convertToCSV(recipes);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="recipes.csv"');
        res.send(csvContent);
        break;

      case 'xlsx':
        const xlsxBuffer = await convertToExcel(recipes);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="recipes.xlsx"');
        res.send(xlsxBuffer);
        break;

      default:
        res.json({
          success: true,
          count: recipes.length,
          recipes,
          exportedAt: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Recipe export error:', error);
    res.status(500).json({
      error: 'Failed to export recipes',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/recipes/stats
 * Get database statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    const stats = await db.getStatistics();

    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recipe stats error:', error);
    res.status(500).json({
      error: 'Failed to get recipe statistics',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/recipes/:id
 * Get a specific recipe by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const db = DatabaseService.getInstance();
    const recipe = await db.getRecipeById(id);

    if (!recipe) {
      return res.status(404).json({
        error: 'Recipe not found',
        id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      recipe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recipe fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch recipe',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/recipes/:id
 * Delete a specific recipe by ID
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const db = DatabaseService.getInstance();
    const deleted = await db.deleteRecipe(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Recipe not found',
        id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Recipe deleted successfully',
      id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recipe deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete recipe',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions
async function convertToCSV(recipes: any[]): Promise<string> {
  const headers = [
    'id', 'title', 'description', 'cuisine_type', 'servings',
    'prep_time', 'cook_time', 'total_time', 'difficulty_level',
    'health_score', 'source_url', 'created_at'
  ];

  const csvContent = [
    headers.join(','),
    ...recipes.map(recipe =>
      headers.map(header => {
        const value = recipe[header];
        return JSON.stringify(value || '');
      }).join(',')
    )
  ].join('\n');

  return csvContent;
}

async function convertToExcel(recipes: any[]): Promise<Buffer> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(recipes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Recipes');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export { router as RecipeApiRoutes };
