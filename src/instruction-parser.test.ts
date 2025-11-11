import { describe, it, expect } from 'vitest';

describe('Instruction Parser Workflow', () => {
  it('should import instruction parser successfully', async () => {
    try {
      const { processInstruction, processInstructions } = await import('./enrichment/instructionParser.js');
      expect(typeof processInstruction).toBe('function');
      expect(typeof processInstructions).toBe('function');
      console.log('✅ Instruction parser imported successfully');
    } catch (error) {
      console.error('❌ Failed to import instruction parser:', error);
      throw error;
    }
  });

  it('should process a simple instruction', async () => {
    try {
      const { processInstruction } = await import('./enrichment/instructionParser.js');
      
      const testInstruction = "Preheat oven to 350°F";
      const stepNumber = 1;
      const parsed = processInstruction(testInstruction, stepNumber);
      
      expect(parsed).toBeDefined();
      expect(parsed).toHaveProperty('step_number');
      expect(parsed).toHaveProperty('text');
      expect(parsed).toHaveProperty('action');
      expect(parsed.step_number).toBe(1);
      expect(parsed.text).toBe(testInstruction);
      
      console.log('✅ Basic instruction processing works:', parsed);
    } catch (error) {
      console.error('❌ Instruction processing failed:', error);
      throw error;
    }
  });

  it('should process multiple instructions', async () => {
    try {
      const { processInstructions } = await import('./enrichment/instructionParser.js');
      
      const testInstructions = [
        "Preheat oven to 350°F",
        "Mix flour and sugar in a bowl",
        "Bake for 25 minutes"
      ];
      
      const parsed = processInstructions(testInstructions);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
      expect(parsed[0]).toHaveProperty('step_number');
      expect(parsed[0]).toHaveProperty('action');
      
      console.log('✅ Multiple instruction processing works:', parsed);
    } catch (error) {
      console.error('❌ Multiple instruction processing failed:', error);
      throw error;
    }
  });
});
