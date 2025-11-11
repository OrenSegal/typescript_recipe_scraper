// src/models/Instruction.ts

/*
 * Represents a single step in a recipe's instructions.
 * Mirrors InstructionModel from Python.
 */
export interface Instruction {
  technique: any;
  id: string; // Defaulted by factory in Python (uuid.uuid4())
  step: number;
  text: string;
  timer?: number | null; // Optional timer in minutes
  mentionedIngredientIds?: string[]; // Default factory list in Python
  mentionedEquipmentNames?: string[]; // Default factory list in Python (might be deprecated)
  action?: string | null; // e.g., "mix", "bake"
  equipment?: string[] | null; // Default factory list in Python, e.g., ["oven", "bowl"]
}
