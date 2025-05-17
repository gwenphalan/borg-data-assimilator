import Bottleneck from 'bottleneck';
import { getConfig } from '../../config/loadConfig';
import { ModelConfig } from '../../config/config.schema'; // Assuming ModelConfig is part of your schema
import logger from '../../utils/logger'; // Added logger import

const MODULE_NAME = "LimiterService"; // Define module name for logging

const appConfig = getConfig();
const googleAiStudioProviderConfig = appConfig.providers.google_ai_studio;

const modelLimiters = new Map<string, Bottleneck>();

// Initialize limiters for all configured models that have RPM settings
if (googleAiStudioProviderConfig?.models) {
  for (const [modelId, modelFileConfig] of Object.entries(googleAiStudioProviderConfig.models)) {
    // Ensure modelFileConfig is treated as ModelConfig which might have rate_limits
    const mc = modelFileConfig as ModelConfig; 
    if (mc.rate_limits?.rpm && mc.rate_limits.rpm > 0) {
      const rpm = mc.rate_limits.rpm;
      const minTime = Math.ceil(60000 / rpm); // Milliseconds between requests
      modelLimiters.set(modelId, new Bottleneck({ minTime }));
      logger.info(MODULE_NAME, `Initialized for ${modelId}: ${rpm} RPM (${minTime}ms interval)`);
    }
  }
}

/**
 * Retrieves the Bottleneck limiter instance for a given model ID.
 * @param modelId The ID of the model.
 * @returns The Bottleneck instance if a limiter is configured, otherwise undefined.
 */
export function getLimiter(modelId: string): Bottleneck | undefined {
  return modelLimiters.get(modelId);
}

/**
 * Estimates the total time required for a number of calls to a specific model,
 * based on its configured RPM rate limit.
 *
 * @param numberOfCalls The total number of calls to be made.
 * @param modelId The ID of the model to be called.
 * @returns An object containing the estimated time in seconds and a message.
 */
export function estimateGenerationTime({ numberOfCalls, modelId }: { numberOfCalls: number; modelId: string }): { estimatedSeconds: number; message: string } {
  logger.debug(MODULE_NAME, `Estimating generation time for ${numberOfCalls} calls to model ${modelId}.`);
  const modelEntry = googleAiStudioProviderConfig?.models?.[modelId];
  // Ensure modelEntry is treated as ModelConfig or similar type that has rate_limits
  const specificModelConfig = modelEntry as ModelConfig | undefined;
  const rpm = specificModelConfig?.rate_limits?.rpm;
  let result;

  if (rpm && rpm > 0) {
    const secondsPerCall = 60 / rpm;
    const totalEstimatedSeconds = numberOfCalls * secondsPerCall;
    result = {
      estimatedSeconds: totalEstimatedSeconds,
      message: `Estimated time for ${numberOfCalls} calls to ${modelId} at ${rpm} RPM: ${totalEstimatedSeconds.toFixed(2)} seconds (${(totalEstimatedSeconds / 60).toFixed(2)} minutes).`,
    };
  } else {
    result = {
      estimatedSeconds: 0,
      message: `Rate limits (RPM) not configured for model ${modelId} or RPM is zero/invalid. Cannot estimate time based on client-side rate limiting.`,
    };
  }
  logger.info(MODULE_NAME, result.message);
  return result;
}

export default {
  getLimiter,
  estimateGenerationTime,
  modelLimiters // Exporting for potential direct access or testing, can be removed if not needed
};
