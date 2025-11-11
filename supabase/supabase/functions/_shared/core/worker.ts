

import { fetchAndProcessRecipe } from '../../../../functions/_shared/core/processor';
import { DatabaseService } from '../../../../functions/_shared/services/databaseService';
import { jobQueue } from '../utils/jobQueue';

async function processQueue() {
  while (true) {
    if (jobQueue.length > 0) {
      const job = jobQueue.getNext();
      if (job) {
        console.log(`Processing job for URL: ${job.url}`);
        const recipe = await fetchAndProcessRecipe(job.url, job.options);
        if (recipe) {
          await DatabaseService.saveRecipe(recipe);
        }
      }
    } else {
      // Wait for a short period before checking for new jobs
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

processQueue();