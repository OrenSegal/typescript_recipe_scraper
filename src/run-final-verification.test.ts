import { describe, it, expect } from 'vitest';
import { FinalVerificationSuite } from './verification/finalVerification.js';

describe('Final Verification Suite', () => {
  it('should run the full verification suite and pass for production readiness', async () => {
    console.log('🚀 Starting Recipe Parsing Service Final Verification...\n');
    
    try {
      const result = await FinalVerificationSuite.runFullVerification();
      
      // If verification fails, the suite is designed to throw an error, which will fail the test.
      // If it passes, we explicitly assert that it's ready for production.
      expect(result.readyForProduction).toBe(true);

    } catch (error) {
      console.error('❌ Final verification failed:', error);
      // Re-throw the error to ensure the test fails
      throw error;
    }
  });
});
