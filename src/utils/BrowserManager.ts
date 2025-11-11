const puppeteer = require('puppeteer-extra');
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

/**
 * Manages a singleton Puppeteer browser instance to be shared across the application.
 * This prevents the costly operation of launching a new browser for every request.
 */
export class BrowserManager {
    private static instance: BrowserManager;
    private browser: Browser | null = null;

    private constructor() {}

    /**
     * Gets the singleton instance of the BrowserManager.
     * @returns The singleton instance.
     */
    public static getInstance(): BrowserManager {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }

    /**
     * Retrieves the active Puppeteer browser instance, launching a new one if necessary.
     * @returns A promise that resolves to the Puppeteer Browser instance.
     */
    public async getBrowser(): Promise<Browser> {
        if (!this.browser || !this.browser.isConnected()) {
            console.log('🚀 Launching new Puppeteer browser instance with stealth plugin...');
            (puppeteer as any).use(StealthPlugin());
            this.browser = await (puppeteer as any).launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--proxy-server=\'direct://\'',
                    '--proxy-bypass-list=*'
                ],
            });
            if (this.browser) {
                this.browser.on('disconnected', () => {
                    console.log('Browser disconnected.');
                    this.browser = null;
                });
            }
        }
        if (!this.browser) {
            throw new Error('Failed to launch or retrieve browser instance.');
        }
        return this.browser;
    }

    /**
     * Creates a new page in the browser with enhanced anti-bot detection evasions.
     * @returns A promise that resolves to a new Puppeteer Page instance.
     */
    public async newPage(): Promise<Page> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();


        return page;
    }

    /**
     * Closes the browser instance if it is open.
     */
    public async closeBrowser(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('Browser closed.');
        }
    }
}
