import { loadAppConfig, getConfig } from './config/loadConfig';
import { CacheService, PersistentCacheConfig } from './services/cache';
import path from 'path';
import logger from './utils/logger';
import fileUtils from './utils/file';
import { GeminiClient } from './services/llm/geminiClient.js';

const APP_MODULE_NAME = "ApplicationLoader";

let geminiClientInstance: GeminiClient | null = null;

/**
 * Initializes and registers shared cache services.
 * This function should be called after the application configuration has been loaded.
 */
export async function initializeSharedCacheServices(): Promise<void> {
  logger.info(APP_MODULE_NAME, "Initializing shared cache services...");

  try {
    // Configure and initialize TranscriptParserCache
    const transcriptCacheDirName = "transcripts"; // Corrected namespace
    const globalCacheBasePath = path.join(__dirname, '..', 'cache'); // e.g., project_root/cache
    
    // Ensure the global base cache directory exists
    await fileUtils.createDirectory(globalCacheBasePath);
    logger.debug(APP_MODULE_NAME, `Ensured global cache base directory exists at: ${globalCacheBasePath}`);

    const transcriptPersistentConfig: PersistentCacheConfig = {
      basePath: globalCacheBasePath // CacheService will create a subdir for its namespace here
    };

    new CacheService(
      transcriptCacheDirName, 
      3600 * 24 * 7, // Default 1 week TTL
      transcriptPersistentConfig
    );
    // Instance is auto-registered by its constructor
    logger.info(APP_MODULE_NAME, `CacheService for "${transcriptCacheDirName}" initialized and registered.`);

    // --- Initialize other shared cache services here as needed ---

    logger.info(APP_MODULE_NAME, "Shared cache services initialization complete.");

  } catch (error) {
    logger.error(APP_MODULE_NAME, "Failed to initialize shared cache services:", error);
    throw error; // Re-throw to be caught by initializeApp
  }
}

/**
 * Initializes the entire application: loads configuration, initializes services.
 */
export async function initializeApp(): Promise<void> {
  logger.info(APP_MODULE_NAME, "Starting application initialization...");
  try {
    // 1. Load application configuration first
    await loadAppConfig();
    logger.info(APP_MODULE_NAME, "Application configuration loaded successfully.");

    // 2. Initialize Gemini Client
    const currentAppConfig = getConfig();
    if (!currentAppConfig.providers.google_ai_studio) {
      logger.error(APP_MODULE_NAME, "Google AI Studio provider configuration is missing. Cannot initialize GeminiClient.");
      throw new Error("Google AI Studio provider configuration is missing in app config.");
    }
    geminiClientInstance = new GeminiClient(currentAppConfig.providers.google_ai_studio);
    logger.info(APP_MODULE_NAME, "GeminiClient initialized and ready.");

    // 3. Initialize shared cache services
    await initializeSharedCacheServices();

    logger.info(APP_MODULE_NAME, "Application initialization complete.");

  } catch (error) {
    logger.error(APP_MODULE_NAME, "Critical error during application initialization:", error);
    process.exit(1); 
  }
}

// Export a function to easily get a cache service
export const getCacheService = CacheService.getService;

/**
 * Retrieves the initialized GeminiClient instance.
 * Throws an error if the client has not been initialized yet (i.e., initializeApp was not called or failed).
 * @returns The GeminiClient instance.
 */
export function getGeminiClient(): GeminiClient {
  if (!geminiClientInstance) {
    throw new Error("GeminiClient has not been initialized. Call initializeApp() first.");
  }
  return geminiClientInstance;
}

// Potentially, an application might have a main function or an init block:
async function main() {
  await initializeApp();
  // ... rest of application startup ...
  const tpCache = getCacheService("transcripts");
  if (tpCache) {
     logger.info(APP_MODULE_NAME, "Successfully retrieved 'transcripts' CacheService post-init.");
  }

  // Example of getting and using the Gemini client
  try {
    const client = getGeminiClient();
    logger.info(APP_MODULE_NAME, `Successfully retrieved GeminiClient. Default model: ${client.defaultModelName}`);
    // const response = await client.generateText("Tell me a fun fact about space.");
    // logger.info(APP_MODULE_NAME, `Gemini Response: ${response}`);
  } catch (error) {
    logger.error(APP_MODULE_NAME, "Error using GeminiClient after init:", error);
  }
}

if (require.main === module) {
   main().catch(err => {
     // Error is already logged by initializeApp if it fails critically
   });
}
