import { DataQualityLogger } from './utils/dataQualityLogger.js';
import { WebsiteManager, RecipeWebsite } from './websiteManager.js';
import { BatchRecipeProcessor as ProcessorBatchRecipeProcessor } from './processor/BatchRecipeProcessor.js';

export class BatchRecipeProcessor {
    private websiteManager: WebsiteManager;
    private logger: DataQualityLogger;

    constructor() {
        this.websiteManager = new WebsiteManager('data/recipe-websites.csv');
        this.logger = DataQualityLogger.getInstance();
    }

    public async processWebsites(websites: RecipeWebsite[]): Promise<void> {
        for (const website of websites) {
            if (website.status === 'inactive') {
                console.log(`Skipping inactive website: ${website.name}`);
                this.logger.logIssue(website.name, 'website-status', 'Skipping inactive website');
                continue;
            }

            console.log(`\n🚀 Processing website: ${website.name}`);

            const urlToScrape = website.testRecipeUrl || website.mainUrl;
            if (!website.testRecipeUrl) {
                console.warn(`⚠️ No testRecipeUrl found for ${website.name}, falling back to mainUrl.`);
            }

            // Use direct scraping approach instead of ProductionPipeline
            try {
                const batchProcessor = new ProcessorBatchRecipeProcessor();
                const result = await batchProcessor.processUrls([urlToScrape]);
                console.log(`✅ Successfully processed ${result.successful} recipes for ${website.name}.`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`❌ Error processing ${website.name}:`, errorMessage);
                this.logger.logIssue(website.name, 'pipeline-execution', `Processing failed for website: ${errorMessage}`);
            }
        }
    }

    public async run(): Promise<void> {
        console.log('Starting batch recipe processing...');
        await this.websiteManager.loadWebsites();
        const allWebsites = await this.websiteManager.getAllWebsites();
        await this.processWebsites(allWebsites);
        console.log('Batch recipe processing finished.');
    }

}
