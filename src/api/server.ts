import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { RecipeApiRoutes } from './routes/RecipeApiRoutes.js';
import { WebsiteApiRoutes } from './routes/WebsiteApiRoutes.js';
import { SocialMediaApiRoutes } from './routes/SocialMediaApiRoutes.js';
import { DatabaseService } from '../services/DatabaseService.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
  rateLimit?: number;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const app = express();
  const port = options.port || 3000;
  const host = options.host || 'localhost';

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS
  if (options.cors) {
    app.use(cors({
      origin: true,
      credentials: true
    }));
  }

  // Rate limiting
  if (options.rateLimit) {
    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: options.rateLimit,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      }
    });
    app.use(limiter);
  }

  // Initialize database
  try {
    const db = DatabaseService.getInstance();
    await db.initialize();
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const db = DatabaseService.getInstance();
      const health = await db.healthCheck();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: health
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // API Documentation endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'TypeScript Recipe Scraper Service',
      version: '1.0.0',
      description: 'REST API for scraping, crawling, and processing recipes from websites and social media',
      endpoints: {
        health: 'GET /health',
        recipes: {
          scrape: 'POST /api/recipes/scrape',
          export: 'GET /api/recipes/export',
          stats: 'GET /api/recipes/stats'
        },
        websites: {
          crawl: 'POST /api/websites/crawl',
          add: 'POST /api/websites',
          list: 'GET /api/websites',
          batch: 'POST /api/websites/batch'
        },
        social: {
          scrapePost: 'POST /api/social/scrape',
          scrapeAccount: 'POST /api/social/account'
        }
      },
      documentation: '/api/docs'
    });
  });

  // API Routes
  app.use('/api/recipes', RecipeApiRoutes);
  app.use('/api/websites', WebsiteApiRoutes);
  app.use('/api/social', SocialMediaApiRoutes);

  // API Documentation
  app.get('/api/docs', (req, res) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'Recipe Scraper API',
        version: '1.0.0',
        description: 'Comprehensive recipe scraping and processing API'
      },
      paths: {
        '/api/recipes/scrape': {
          post: {
            summary: 'Scrape a single recipe',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      url: { type: 'string', format: 'uri' },
                      enrich: { type: 'boolean', default: true },
                      save: { type: 'boolean', default: true }
                    },
                    required: ['url']
                  }
                }
              }
            }
          }
        },
        '/api/websites/crawl': {
          post: {
            summary: 'Crawl and scrape all recipes from a website',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      domain: { type: 'string' },
                      depth: { type: 'integer', minimum: 1, maximum: 5 },
                      limit: { type: 'integer', minimum: 1 },
                      useSitemap: { type: 'boolean', default: false },
                      batchSize: { type: 'integer', default: 10 }
                    },
                    required: ['domain']
                  }
                }
              }
            }
          }
        },
        '/api/social/scrape': {
          post: {
            summary: 'Scrape a single social media post',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      url: { type: 'string', format: 'uri' },
                      platform: { type: 'string', enum: ['instagram', 'tiktok', 'youtube'] },
                      enableOCR: { type: 'boolean', default: false },
                      enableTranscription: { type: 'boolean', default: false },
                      save: { type: 'boolean', default: true }
                    },
                    required: ['url']
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  // Error handling middleware
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `Endpoint ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString()
    });
  });

  // Start server
  const server = app.listen(port, host, () => {
    console.log(`🚀 Recipe Scraper API Server running at http://${host}:${port}`);
    console.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
    console.log(`❤️ Health Check: http://${host}:${port}/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🔄 Shutting down server...');
    server.close(() => {
      console.log('✅ Server shut down gracefully');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🔄 Shutting down server...');
    server.close(() => {
      console.log('✅ Server shut down gracefully');
      process.exit(0);
    });
  });
}
