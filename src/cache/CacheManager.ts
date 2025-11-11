/**
 * Multi-Layer Caching System
 * L1: In-Memory LRU Cache (< 1ms)
 * L2: Upstash Redis (< 50ms) - FREE tier compatible
 * L3: Database Cache Table (< 100ms)
 */

import { LRUCache } from 'lru-cache';
import { Redis } from '@upstash/redis';
import { Recipe } from '../types.js';

export interface CacheConfig {
  enableMemoryCache?: boolean;
  enableRedisCache?: boolean;
  enableDBCache?: boolean;
  ttl?: number; // Time to live in seconds
}

export class CacheManager {
  private static instance: CacheManager;

  // L1: In-memory LRU cache for hot data
  private memoryCache: LRUCache<string, Recipe>;

  // L2: Upstash Redis for distributed caching (FREE tier: 10K commands/day)
  private redis: Redis | null = null;

  private config: Required<CacheConfig>;

  private constructor(config: CacheConfig = {}) {
    this.config = {
      enableMemoryCache: config.enableMemoryCache ?? true,
      enableRedisCache: config.enableRedisCache ?? true,
      enableDBCache: config.enableDBCache ?? true,
      ttl: config.ttl ?? 3600 // 1 hour default
    };

    // Initialize memory cache
    this.memoryCache = new LRUCache({
      max: 1000, // Store up to 1000 recipes in memory
      ttl: 1000 * 60 * 30, // 30 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Initialize Upstash Redis (only if credentials provided)
    if (this.config.enableRedisCache && process.env.UPSTASH_REDIS_REST_URL) {
      try {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!
        });
        console.log('✅ Upstash Redis cache initialized (FREE tier)');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Redis, using memory cache only:', error);
        this.redis = null;
      }
    } else {
      console.log('ℹ️ Redis disabled - using memory cache only');
    }
  }

  public static getInstance(config?: CacheConfig): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Get recipe from cache with multi-layer fallback
   */
  async get(url: string): Promise<Recipe | null> {
    const key = this.normalizeKey(url);

    // L1: Memory cache (< 1ms)
    if (this.config.enableMemoryCache) {
      const memResult = this.memoryCache.get(key);
      if (memResult) {
        console.log(`🎯 Cache HIT (memory): ${url}`);
        return memResult;
      }
    }

    // L2: Redis cache (< 50ms)
    if (this.config.enableRedisCache && this.redis) {
      try {
        const redisResult = await this.redis.get<Recipe>(key);
        if (redisResult) {
          console.log(`🎯 Cache HIT (redis): ${url}`);
          // Promote to memory cache
          if (this.config.enableMemoryCache) {
            this.memoryCache.set(key, redisResult);
          }
          return redisResult;
        }
      } catch (error) {
        console.warn('⚠️ Redis get failed:', error);
      }
    }

    // L3: Database cache would go here (if implemented)
    // This is optional and can query Supabase recipes_cache table

    console.log(`❌ Cache MISS: ${url}`);
    return null;
  }

  /**
   * Set recipe in cache with multi-layer write-through
   */
  async set(url: string, recipe: Recipe, ttl?: number): Promise<void> {
    const key = this.normalizeKey(url);
    const cacheTTL = ttl || this.config.ttl;

    // L1: Write to memory cache
    if (this.config.enableMemoryCache) {
      this.memoryCache.set(key, recipe);
    }

    // L2: Write to Redis cache
    if (this.config.enableRedisCache && this.redis) {
      try {
        await this.redis.setex(key, cacheTTL, recipe);
        console.log(`💾 Cached to Redis: ${url} (TTL: ${cacheTTL}s)`);
      } catch (error) {
        console.warn('⚠️ Redis set failed:', error);
      }
    }

    // L3: Database cache (optional - for persistence)
    // await this.writeToDB(key, recipe);
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(url: string): Promise<void> {
    const key = this.normalizeKey(url);

    // Remove from memory
    if (this.config.enableMemoryCache) {
      this.memoryCache.delete(key);
    }

    // Remove from Redis
    if (this.config.enableRedisCache && this.redis) {
      try {
        await this.redis.del(key);
        console.log(`🗑️ Invalidated cache: ${url}`);
      } catch (error) {
        console.warn('⚠️ Redis delete failed:', error);
      }
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    // Clear memory cache
    if (this.config.enableMemoryCache) {
      this.memoryCache.clear();
    }

    // Clear Redis cache (use with caution!)
    if (this.config.enableRedisCache && this.redis) {
      try {
        await this.redis.flushdb();
        console.log('🗑️ Cleared all Redis cache');
      } catch (error) {
        console.warn('⚠️ Redis flush failed:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memorySize: this.memoryCache.size,
      memoryMax: this.memoryCache.max,
      memoryHitRate: this.memoryCache.size > 0 ?
        (this.memoryCache.size / (this.memoryCache.max || 1000)) * 100 : 0,
      redisEnabled: !!this.redis,
      config: this.config
    };
  }

  /**
   * Normalize URL to cache key
   */
  private normalizeKey(url: string): string {
    try {
      const normalized = new URL(url);
      // Remove tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'gclid'];
      paramsToRemove.forEach(param => normalized.searchParams.delete(param));
      return `recipe:v2:${normalized.href}`;
    } catch {
      // If URL parsing fails, use as-is
      return `recipe:v2:${url}`;
    }
  }
}

/**
 * Convenience wrapper for cache operations
 */
export async function getCachedRecipe(url: string): Promise<Recipe | null> {
  const cache = CacheManager.getInstance();
  return await cache.get(url);
}

export async function setCachedRecipe(url: string, recipe: Recipe, ttl?: number): Promise<void> {
  const cache = CacheManager.getInstance();
  await cache.set(url, recipe, ttl);
}

export async function invalidateCachedRecipe(url: string): Promise<void> {
  const cache = CacheManager.getInstance();
  await cache.invalidate(url);
}
