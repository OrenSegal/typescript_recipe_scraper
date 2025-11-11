import { jobQueue } from '../utils/jobQueue';
import { fetchAndProcessRecipe } from './processor';
import { DatabaseService } from '../services/databaseService';

async function processQueue() {
  while (true) {
    try {
      const job = jobQueue.getNext();
      if (job) {
        console.log(`Processing job for URL: ${job.url}`);
        try {
          const recipe = await fetchAndProcessRecipe(job.url, job.options);
          if (recipe) {
            await DatabaseService.saveRecipe(recipe);
          }
        } catch (error) {
          console.error(`Error processing job for URL ${job.url}:`, error);
        }
      } else {
        // Wait for 5 seconds before checking for new jobs
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error('Error in worker loop:', error);
      // Wait before retrying after an error
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  processQueue().catch(console.error);
}

export { processQueue };
