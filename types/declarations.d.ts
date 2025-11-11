// Provides basic type info for 'ingredient-parser-plus'
declare module 'ingredient-parser-plus' {
  export interface ParsedIngredient {
    amount: string;
    unit: string | null;
    ingredient: string;
    preparationNotes: string | null;
  }
  export function parse(ingredient: string, options?: { normalizeUom: boolean }): ParsedIngredient;
}