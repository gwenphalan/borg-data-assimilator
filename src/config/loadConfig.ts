import yaml from 'js-yaml';
import path from 'path';
import * as dotenv from 'dotenv';
import fileUtils from '../utils/file'; // Ensure this path is correct
import { AppConfig, ProvidersConfig } from './config.schema';
import logger from '../utils/logger'; // Added logger import

// Load environment variables from .env file
dotenv.config();

const CONFIG_FILE_NAME = 'config.yml';
// Resolves to project_root/config.yml assuming loadConfig.ts is in project_root/src/config/
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../', CONFIG_FILE_NAME);

const MODULE_NAME = 'ConfigLoader'; // Added module name

let loadedConfig: AppConfig | null = null;

/**
 * Merges API keys from environment variables into the provider configuration.
 * Environment variables take precedence over values in config.yml.
 * @param providersConfig The providers configuration parsed from YAML.
 */
function mergeApiKeysFromEnv(providersConfig: ProvidersConfig): void {
  // Note: Google AI Studio typically uses Application Default Credentials (ADC)
  // or service account keys managed outside .env for direct API key parameter.
  // If you had a specific GOOGLE_AI_STUDIO_API_KEY for a model, you'd handle it here.
  const googleApiKeyFromEnv = process.env.GOOGLE_API_KEY;
  if (providersConfig.google_ai_studio) {
    if (googleApiKeyFromEnv) {
      providersConfig.google_ai_studio.apiKey = googleApiKeyFromEnv;
      logger.info(MODULE_NAME, 'Loaded Google AI Studio API key from GOOGLE_API_KEY environment variable.');
    } else if (!providersConfig.google_ai_studio.apiKey) {
      // This warning might be relevant if you expect a key but ADC might be an alternative
      // logger.warn(MODULE_NAME, 'Google AI Studio is configured, but GOOGLE_API_KEY environment variable is not set and no apiKey is in config.yml. Application Default Credentials may be used if available.');
    }
  }

  // OpenRouter
  const openRouterApiKeyFromEnv = process.env.OPENROUTER_API_KEY;
  if (providersConfig.openrouter?.free_models) {
    let keySourceLogged = false;
    for (const modelKey in providersConfig.openrouter.free_models) {
      if (providersConfig.openrouter.free_models.hasOwnProperty(modelKey)) {
        if (openRouterApiKeyFromEnv) {
          providersConfig.openrouter.free_models[modelKey].api_key = openRouterApiKeyFromEnv;
          if (!keySourceLogged) {
            logger.info(MODULE_NAME, 'Loaded/Overrode OpenRouter API key for all configured models from OPENROUTER_API_KEY environment variable.');
            keySourceLogged = true;
          }
        } else if (!providersConfig.openrouter.free_models[modelKey].api_key || 
                   providersConfig.openrouter.free_models[modelKey].api_key === '<YOUR_OPENROUTER_API_KEY>') {
          // Warning already handled in post-merge validation, but can be kept if desired
          // logger.warn(MODULE_NAME, `OpenRouter model '${modelKey}' API key is missing or placeholder in config.yml and no OPENROUTER_API_KEY env var is set.`);
        }
      }
    }
  }

  // TogetherAI
  const togetherAiApiKeyFromEnv = process.env.TOGETHER_AI_API_KEY;
  if (providersConfig.together_ai?.chat) {
    if (togetherAiApiKeyFromEnv) {
      providersConfig.together_ai.chat.api_key = togetherAiApiKeyFromEnv;
      logger.info(MODULE_NAME, 'Loaded/Overrode TogetherAI API key from TOGETHER_AI_API_KEY environment variable.');
    } else if (!providersConfig.together_ai.chat.api_key || 
               providersConfig.together_ai.chat.api_key === '<YOUR_TOGETHER_AI_API_KEY>'){
       // Warning handled in post-merge validation
    }
  }
}

/**
 * Asynchronously loads, parses, and validates the application configuration from a YAML file.
 * API keys are merged from environment variables.
 * Caches the configuration after the first successful load (for the default path).
 * @param configPath The absolute path to the YAML configuration file. Defaults to `config.yml` in the project root.
 * @returns A promise that resolves with the application configuration object.
 * @throws Error if the configuration file cannot be read, parsed, or essential keys/sections are missing.
 */
export async function loadAppConfig(configPath: string = DEFAULT_CONFIG_PATH): Promise<AppConfig> {
  if (loadedConfig && configPath === DEFAULT_CONFIG_PATH) {
    return loadedConfig; // Return cached version if using default path and already loaded
  }

  try {
    const fileContent = await fileUtils.readFile(configPath);
    const parsedConfig = yaml.load(fileContent) as AppConfig; // Type assertion

    if (!parsedConfig) {
      throw new Error('Configuration file is empty or invalid after parsing.');
    }
    if (!parsedConfig.logging || !parsedConfig.providers || !parsedConfig.batch_processing) {
      throw new Error('Core configuration sections (logging, providers, batch_processing) are missing in config.yml.');
    }

    // Merge API keys from environment variables into the parsed config
    mergeApiKeysFromEnv(parsedConfig.providers);
    
    // Post-merge validation for API keys
    // Google AI Studio: Ensure API key is present if configured and GOOGLE_API_KEY was expected
    if (parsedConfig.providers.google_ai_studio) {
      // If GOOGLE_API_KEY is the primary way you provide the key, enforce its presence.
      // If ADC is a valid fallback, this check might need to be more nuanced.
      if (!parsedConfig.providers.google_ai_studio.apiKey || parsedConfig.providers.google_ai_studio.apiKey.trim() === '') {
        logger.warn(
          MODULE_NAME,
          `Google AI Studio API key is missing. ` +
          `Please set the GOOGLE_API_KEY environment variable. ` +
          `If you intend to use Application Default Credentials, this warning can be ignored if ADC is set up correctly.`
        );
        // Depending on strictness and whether ADC is a viable fallback, you might throw an error here:
        // throw new Error(
        //   `Google AI Studio API key is missing. ` +
        //   `Please set the GOOGLE_API_KEY environment variable.`
        // );
      }
    }

    // OpenRouter: Ensure API key is present if openrouter is configured
    if (parsedConfig.providers.openrouter?.free_models) {
      for (const modelKey in parsedConfig.providers.openrouter.free_models) {
        if (parsedConfig.providers.openrouter.free_models.hasOwnProperty(modelKey)) {
          const model = parsedConfig.providers.openrouter.free_models[modelKey];
          if (!model.api_key || model.api_key === '<YOUR_OPENROUTER_API_KEY>' || model.api_key.trim() === '') {
            throw new Error(
              `OpenRouter model '${modelKey}' API key is missing or invalid. ` +
              `Please set the OPENROUTER_API_KEY environment variable or provide a valid key in config.yml.`
            );
          }
        }
      }
    }

    // TogetherAI: Ensure API key is present if together_ai.chat is configured
    if (parsedConfig.providers.together_ai?.chat) {
      const chatConfig = parsedConfig.providers.together_ai.chat;
      if (!chatConfig.api_key || chatConfig.api_key === '<YOUR_TOGETHER_AI_API_KEY>' || chatConfig.api_key.trim() === '') {
        throw new Error(
          `TogetherAI chat API key is missing or invalid. ` +
          `Please set the TOGETHER_AI_API_KEY environment variable or provide a valid key in config.yml.`
        );
      }
    }

    if (configPath === DEFAULT_CONFIG_PATH) {
      loadedConfig = parsedConfig; // Cache the successfully loaded and validated config
    }
    return parsedConfig;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(MODULE_NAME, `Error loading application configuration from ${configPath}: ${errorMessage}`);
    // Propagate the error to be handled by the calling code (e.g., application startup)
    throw new Error(`Failed to load application configuration: ${errorMessage}`);
  }
}

/**
 * Gets the currently loaded application configuration.
 * Throws an error if the configuration has not been loaded yet via `loadAppConfig()`.
 * @returns The application configuration object.
 * @throws Error if `loadAppConfig()` has not been called successfully first.
 */
export function getConfig(): AppConfig {
  if (!loadedConfig) {
    throw new Error(
      'Configuration has not been loaded. Ensure loadAppConfig() is called and completes successfully before calling getConfig().'
    );
  }
  return loadedConfig;
}

// Optionally, you can export a promise that resolves to the loaded config
// to ensure it's loaded when the module is imported, though explicit loading is often preferred.
// export const configPromise = loadAppConfig();

// To make a pre-loaded config available directly (e.g., for immediate use at startup),
// you could do something like this, but it makes the initial import asynchronous in nature.
// (async () => {
//   try {
//     loadedConfig = await loadAppConfig();
//     logger.info(MODULE_NAME, 'Configuration loaded successfully at module initialization.');
//   } catch (error) {
//     logger.error(MODULE_NAME, 'Failed to pre-load configuration at module initialization:', error);
//     // Application might need to exit or handle this state appropriately
//     process.exit(1); 
//   }
// })();
