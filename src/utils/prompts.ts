import fileUtils from './file';
import path from 'path';
import logger from './logger';

/**
 * Loads a prompt template file and resolves context placeholders within it.
 *
 * @param templatePath - Path to the main template file, relative to `basePath`.
 * @param contextPlaceholders - An object where keys are placeholder names (e.g., "PERSONA_SORTING_CONTEXT")
 *                              and values are paths to the context files, relative to `basePath`.
 * @param basePath - The base directory from which `templatePath` and context file paths are resolved.
 * @returns A promise that resolves to the processed template string with placeholders replaced.
 * @throws Error if template or any specified context file cannot be read.
 */
export async function loadPromptTemplate(
  templatePath: string,
  contextPlaceholders: Record<string, string>,
  basePath: string
): Promise<string> {
  let templateContent: string;
  const fullTemplatePath = path.resolve(basePath, templatePath);

  try {
    templateContent = await fileUtils.readFile(fullTemplatePath);
  } catch (error) {
    logger.error(`Failed to read template file "${fullTemplatePath}": ${(error as Error).message}`);
    throw new Error(`Failed to read template file "${fullTemplatePath}"`);
  }

  for (const placeholderKey in contextPlaceholders) {
    if (Object.prototype.hasOwnProperty.call(contextPlaceholders, placeholderKey)) {
      const contextFilePath = contextPlaceholders[placeholderKey];
      const fullContextFilePath = path.resolve(basePath, contextFilePath);
      let contextContent: string;

      try {
        contextContent = await fileUtils.readFile(fullContextFilePath);
        // Remove trailing newline from context file content to prevent double newlines
        contextContent = contextContent.replace(/\r?\n$/, '');
      } catch (error) {
        logger.error(`Failed to read context file "${fullContextFilePath}" for placeholder {{${placeholderKey}}}: ${(error as Error).message}`);
        throw new Error(`Failed to read context file "${fullContextFilePath}" for placeholder "{{${placeholderKey}}}"`);
      }

      const regex = new RegExp(`\{\{${placeholderKey}\}\}`, 'g');
      templateContent = templateContent.replace(regex, contextContent);
    }
  }

  const remainingPlaceholders = templateContent.match(/\{\{.*?\}\}/g);
  if (remainingPlaceholders) {
    logger.warn(`Unresolved placeholders in template "${templatePath}" (resolved path: "${fullTemplatePath}"): ${remainingPlaceholders.join(', ')}`);
  }

  return templateContent;
}

export default {
  loadPromptTemplate,
};
