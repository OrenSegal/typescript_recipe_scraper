import { describe, it, expect } from 'vitest';

describe('Ingredient Parser Workflow', () => {
  it('should import ingredient parser successfully', async () => {
    try {
      const { processIngredient } = await import('./enrichment/ingredientParser.js');
      expect(typeof processIngredient).toBe('function');
      console.log('✅ Ingredient parser imported successfully');
    } catch (error) {
      console.error('❌ Failed to import ingredient parser:', error);
      throw error;
    }
  });

  it('should process a simple ingredient', async () => {
    try {
      const { processIngredient } = await import('./enrichment/ingredientParser.js');
      
      const testIngredient = { name: "1 cup all-purpose flour" };
      const parsed = await processIngredient(testIngredient);
      
      expect(parsed).toBeDefined();
      expect(parsed).toHaveProperty('quantity');
      expect(parsed).toHaveProperty('unit');
      expect(parsed).toHaveProperty('name');
      
      console.log('✅ Basic ingredient processing works:', parsed);
    } catch (error) {
      console.error('❌ Ingredient processing failed:', error);
      throw error;
    }
  });
});
