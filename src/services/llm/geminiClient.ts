import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, GenerativeModel, SafetySetting } from "@google/generative-ai";
// Import specific types directly from config.schema.ts
import { GoogleAIStudioConfig, ModelConfig as GoogleModelConfig } from "../../config/config.schema";
import Bottleneck from 'bottleneck';
import logger from '../../utils/logger';
// Assuming GoogleAIStudioConfig is defined in your schema and accessible
// import { GoogleAIStudioConfig } from "../../config/config.schema"; 

const MODULE_NAME = "GeminiClient";

// These constants are fine at the module level as they are not config-dependent.
const baseGenerationParams: Partial<GenerationConfig> = {
  temperature: 0.7,
  topP: 1.0,
  topK: 40,
  maxOutputTokens: 2048,
  candidateCount: 1,
};

const safetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export class GeminiClient {
  readonly #apiKey: string;
  readonly #genAI: GoogleGenerativeAI;
  readonly #defaultModelId: string;
  readonly #providerConfig: GoogleAIStudioConfig;
  readonly #modelLimiters = new Map<string, Bottleneck>();

  public get rawGeminiAI(): GoogleGenerativeAI {
    return this.#genAI;
  }

  public get defaultModelName(): string {
    return this.#defaultModelId;
  }

  constructor(providerConfig: GoogleAIStudioConfig) {
    if (!providerConfig) {
      logger.error(MODULE_NAME, "Google AI Studio provider configuration is missing.");
      throw new Error("GeminiClient: Google AI Studio provider configuration is missing.");
    }
    this.#providerConfig = providerConfig;

    if (!this.#providerConfig.apiKey) {
      logger.error(MODULE_NAME, "Google AI Studio API key is not available in the provided configuration.");
      throw new Error("GeminiClient: Google AI Studio API key is not available in the provided configuration.");
    }
    this.#apiKey = this.#providerConfig.apiKey;
    logger.info(MODULE_NAME, "Google AI Studio API key loaded successfully for GeminiClient instance.");

    this.#genAI = new GoogleGenerativeAI(this.#apiKey);
    this.#defaultModelId = this.#providerConfig.default_model_id || "gemini-1.5-flash";
    logger.info(MODULE_NAME, `GeminiClient instance: Default model ID set to: ${this.#defaultModelId}`);

    if (this.#providerConfig.models) {
      for (const [modelId, configValue] of Object.entries(this.#providerConfig.models)) {
        const modelConfig = configValue as GoogleModelConfig;
        if (modelConfig.rate_limits?.rpm && modelConfig.rate_limits.rpm > 0) {
          const rpm = modelConfig.rate_limits.rpm;
          const minTime = Math.ceil(60000 / rpm);
          this.#modelLimiters.set(modelId, new Bottleneck({ minTime }));
          logger.info(MODULE_NAME, `GeminiClient instance: Initialized rate limiter for ${modelId}: ${rpm} RPM (${minTime}ms interval)`);
        }
      }
    }
  }

  public getModel(modelId: string = this.#defaultModelId): GenerativeModel {
    logger.debug(MODULE_NAME, `Instance method getModel called for: ${modelId}`);
    const modelSpecificConfig = this.#providerConfig.models?.[modelId];
    const modelSpecificRequestParams = modelSpecificConfig?.request;

    if (!modelSpecificRequestParams && modelId !== this.#defaultModelId && !this.#providerConfig.models?.[modelId]) {
      logger.warn(MODULE_NAME, `Model ID "${modelId}" not found in instance config. Using default base parameters for it.`);
    }
    
    let finalGenerationConfig: GenerationConfig = {
      ...baseGenerationParams,
      ...(modelSpecificRequestParams || {}),
    } as GenerationConfig;

    if (finalGenerationConfig.maxOutputTokens && typeof finalGenerationConfig.maxOutputTokens !== 'number') {
      finalGenerationConfig.maxOutputTokens = Number(finalGenerationConfig.maxOutputTokens);
    }
    if (finalGenerationConfig.temperature && typeof finalGenerationConfig.temperature !== 'number') {
      finalGenerationConfig.temperature = Number(finalGenerationConfig.temperature);
    }
    if (finalGenerationConfig.topP && typeof finalGenerationConfig.topP !== 'number') {
      finalGenerationConfig.topP = Number(finalGenerationConfig.topP);
    }
    if (finalGenerationConfig.topK && typeof finalGenerationConfig.topK !== 'number') {
      finalGenerationConfig.topK = Number(finalGenerationConfig.topK);
    }
    if (finalGenerationConfig.candidateCount && typeof finalGenerationConfig.candidateCount !== 'number'){
      finalGenerationConfig.candidateCount = Number(finalGenerationConfig.candidateCount);
    }

    logger.debug(MODULE_NAME, `Final generation config for ${modelId}:`, JSON.stringify(finalGenerationConfig, null, 2));

    return this.#genAI.getGenerativeModel({
      model: modelId,
      generationConfig: finalGenerationConfig,
      safetySettings,
    });
  }

  /**
   * Generates text content using the specified model, with distinct system and user prompts.
   * @param userPrompt The primary user prompt (e.g., data to be processed).
   * @param systemPrompt The system prompt to guide the model's behavior.
   * @param modelToUse The model ID to use. Defaults to the instance's default model ID.
   * @returns A promise that resolves with the generated text.
   */
  public async generateText(
    userPrompt: string, 
    systemPrompt: string, 
    modelToUse: string = this.#defaultModelId
  ): Promise<string> {
    logger.info(MODULE_NAME, `Instance method generateText using model: ${modelToUse}`);
    logger.debug(MODULE_NAME, `System Prompt (first 100 chars): "${systemPrompt.substring(0, 100)}..."`);
    logger.debug(MODULE_NAME, `User Prompt (first 100 chars): "${userPrompt.substring(0, 100)}..."`);
    
    const modelInstance = this.getModel(modelToUse);
    const limiter = this.#modelLimiters.get(modelToUse);

    // Construct the conversational prompt for the API
    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model",
        parts: [{ text: "Okay, I understand the instructions and context." }], // Model acknowledges system prompt
      },
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ];

    try {
      const apiCall = () => modelInstance.generateContent({ contents }); // Pass the structured contents
      let result;

      if (limiter) {
        logger.debug(MODULE_NAME, `Scheduling API call to ${modelToUse} via rate limiter for instance.`);
        result = await limiter.schedule(apiCall);
      } else {
        logger.debug(MODULE_NAME, `Calling API ${modelToUse} directly (no RPM rate limiter configured for instance).`);
        result = await apiCall();
      }
      
      const response = result.response;

      if (response?.text) {
        const textResponse = response.text();
        logger.info(MODULE_NAME, `Successfully generated text with ${modelToUse}. Length: ${textResponse.length}`);
        logger.debug(MODULE_NAME, `Response snippet (first 100 chars): "${textResponse.substring(0,100).replace(/\n/g, " ")}"`);
        return textResponse;
      } else {
        logger.error(MODULE_NAME, `Gemini API response for ${modelToUse} did not contain text. Full response:`, JSON.stringify(response, null, 2));
        if (response?.promptFeedback?.blockReason) {
          throw new Error(
            `Content generation blocked for ${modelToUse}. Reason: ${response.promptFeedback.blockReason}. ${response.promptFeedback.blockReasonMessage || ''}`
          );
        }
        throw new Error(`Failed to generate text with ${modelToUse}. The model did not return any content.`);
      }
    } catch (err) {
      const error = err as Error;
      logger.error(MODULE_NAME, `Error generating text with Gemini API (${modelToUse}) for instance:`, error.message, error.stack);
      if (error instanceof Error) {
        throw new Error(`Gemini API error (${modelToUse}): ${error.message}`);
      }
      throw new Error(`An unknown error occurred while communicating with the Gemini API (${modelToUse}).`);
    }
  }

  public estimateGenerationTime({ numberOfCalls, modelId }: { numberOfCalls: number; modelId: string }): { estimatedSeconds: number; message: string } {
    logger.debug(MODULE_NAME, `Instance method estimateGenerationTime for ${numberOfCalls} calls to model ${modelId}.`);
    const modelConfig = this.#providerConfig.models?.[modelId];
    const rpm = modelConfig?.rate_limits?.rpm;
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
        message: `Rate limits (RPM) not configured for model ${modelId} or RPM is zero/invalid in instance config. Cannot estimate time.`,
      };
    }
    logger.info(MODULE_NAME, result.message);
    return result;
  }
}

/*
// Optional: Example usage (main function) can be updated to reflect class instantiation
// This part would typically be in your application entry point or a test script.
async function main() {
  // This example assumes loadAppConfig() has been called and getConfig() is available.
  // This would typically be done at your application's entry point.
  // For this example, you'd need to import loadAppConfig and getConfig from '../../config/loadConfig'
  // e.g. const { loadAppConfig, getConfig } = await import('../../config/loadConfig');
  // await loadAppConfig(); 
  // const appConfig = getConfig();

  // if (!appConfig || !appConfig.providers.google_ai_studio) {
  //   logger.error(MODULE_NAME, "[MainTest] Google AI Studio config missing or appConfig not loaded for main test.");
  //   return;
  // }
  
  // const gemini = new GeminiClient(appConfig.providers.google_ai_studio);
  // const modelToTest = gemini.defaultModelName;
  // logger.info(MODULE_NAME, `[MainTest] Using model: ${modelToTest}`);

  // const estimation = gemini.estimateGenerationTime({ numberOfCalls: 20, modelId: modelToTest });
  // logger.info(MODULE_NAME, estimation.message); // Already logged
  
  // const prompts = Array.from({ length: 5 }, (_, i) => `Write a very short poem about instance call number ${i + 1}.`);
  
  // logger.info(MODULE_NAME, `[MainTest] Starting a batch of ${prompts.length} calls to ${modelToTest} via GeminiClient instance...`);
  // const startTime = Date.now();

  // const results = await Promise.all(prompts.map(async (prompt, i) => {
  //   logger.debug(MODULE_NAME, `[MainTest] Sending prompt ${i + 1}: "${prompt.substring(0,30)}..."`);
  //   try {
  //     const text = await gemini.generateText(prompt, modelToTest);
  //     logger.info(MODULE_NAME, `[MainTest] Response ${i + 1} for ${modelToTest}: "${text.substring(0, 50).replace(/\n/g, ' ')}"...`);
  //     return text;
  //   } catch (e) { 
  //     const error = e as Error;
  //     logger.error(MODULE_NAME, `[MainTest] Error for prompt ${i + 1} with ${modelToTest}:`, error.message);
  //     return null;
  //   }
  // }));

  // const endTime = Date.now();
  // const durationSeconds = (endTime - startTime) / 1000;
  // logger.info(MODULE_NAME, `[MainTest] Batch of ${prompts.length} calls to ${modelToTest} completed in ${durationSeconds.toFixed(2)} seconds.`);
  // logger.info(MODULE_NAME, "[MainTest] Results:", results.filter(r => r !== null).length, "successful responses.");

  // } catch (e) { 
  //   const error = e as Error;
  //   logger.error(MODULE_NAME, "[MainTest] Error in example usage main function:", error.message, error.stack);
  // }
}

// Example of how to run main if this file were executed directly (after config loading)
// if (require.main === module) {
//   (async () => {
//     try {
//       const { loadAppConfig } = await import('../../config/loadConfig'); 
//       await loadAppConfig(); 
//       // Now that config is loaded, you could potentially run main()
  //       // await main(); 
  //     } catch (e) {
  //       const error = e as Error;
  //       logger.error(MODULE_NAME, "[MainTest] Failed to load config and run main:", error.message);
  //       process.exit(1);
  //     }
  //   })();
  // }
*/

// Path: src/services/llm/geminiClient.ts
