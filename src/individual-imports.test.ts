import { describe, it, expect } from 'vitest';

describe('Individual Import Tests', () => {
  it('should import vitest functions', () => {
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });

  it('should import Supabase client', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    expect(typeof createClient).toBe('function');
  });

  it('should import database function', async () => {
    try {
      const { processAndSaveRecipe } = await import('./database.js');
      expect(typeof processAndSaveRecipe).toBe('function');
    } catch (error) {
      console.error('Failed to import database:', error);
      throw error;
    }
  });
});
