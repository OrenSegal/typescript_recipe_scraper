import 'dotenv/config';

export const config = {
  // Supabase credentials
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // External API keys
  googleApiKey: process.env.GOOGLE_API_KEY,
  usdaApiKey: process.env.USDA_API_KEY,

  // Microservice URLs (optional)
  ytDlpMicroserviceUrl: process.env.YT_DLP_MICROSERVICE_URL,
};

// Runtime validation to fail fast if the environment is not configured correctly.
if (!config.supabaseUrl || !config.supabaseServiceKey) {
  throw new Error(
    "FATAL ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in your environment variables."
  );
}