# Borg Data Assimilator

Extracts and converts any character dialogue from any script into fine‑tuning data for LLMs, implemented in TypeScript/Node.js.

```
src/
├── commands/                             # CLI command handlers using yargs
│   ├── convert.ts                        # Converts raw dialogue into structured fine-tuning data
│   ├── extract.ts                        # Extracts lines from transcripts for a given persona
│   ├── index.ts                          # Central CLI entry point — dispatches to subcommands
│   └── infer.ts                          # Runs inference with Gemini to generate new dialogue pairs
│
├── config/                               # Configuration logic and schema validation
│   ├── config.schema.ts                  # Zod schema defining the structure of config.yml
│   └── loadConfig.ts                     # Loads and validates config.yml at runtime
│
├── data/                                 # Data output and cache directory
│   ├── converted/                        # Fine-tuning ready dialogue pairs
│   │   ├── borg/
│   │   └── locutus/
│   │       └── tuning_data_batched-*.json  # Batched prompt/response pairs ready for training
│   ├── inferred/                         # AI-generated data via inference
│   │   ├── borg/
│   │   └── locutus/
│   │       └── tuning_data_inferred-*.json # Few-shot generated pairs from Gemini
│   ├── raw/                              # Unprocessed extracted character dialogue
│   │   ├── borg/
│   │   │   └── character_lines.json      # Raw line extraction results for "borg"
│   │   └── locutus/
│   └── sorted/                           # Sorted or filtered intermediate results
│       ├── borg/
│       └── locutus/
│
├── index.ts                              # Optional programmatic entrypoint (can be used for scripts/tests)
│
├── prompts/                              # Prompt templates for Gemini model usage
│   ├── context/
│   │   ├── borg/
│   │   │   ├── inference_context.txt     # Few-shot or in-context examples for "borg"
│   │   │   ├── sorting_conditions.txt    # Conditions for sorting/cleaning data
│   │   │   └── sorting_context.txt       # Prompt to instruct sorting LLM pass
│   │   └── locutus/
│   │       ├── inference_context.txt
│   │       ├── sorting_conditions.txt
│   │       └── sorting_context.txt
│   └── templates/
│       ├── fine-tuning-data-converter.txt # Prompt for converting raw lines into prompt/response
│       ├── fine-tuning-data-inference.txt # Prompt to instruct Gemini to generate new samples
│       └── fine-tuning-data-sorter.txt    # Prompt to sort, clean, or categorize dialogue
│
├── services/                             # Core logic grouped by domain
│   ├── aggregator.ts                     # Aggregates multiple batches of fine-tuning data
│   ├── llm/
│   │   ├── geminiClient.ts               # Gemini API wrapper using official Node SDK
│   │   ├── generator.ts                  # Handles inference logic: builds requests, handles responses
│   │   └── limiter.ts                    # Rate limits API calls (RPM, TPM, etc.)
│   └── transcript/
│       ├── parser.ts                     # Parses transcript files and extracts dialogue lines
│       └── types.ts                      # Types used by the transcript parser
│
├── types/                                # Global/shared TypeScript types
│   ├── persona.ts                        # Types for persona names, config, metadata
│   └── tuningData.ts                     # Types for prompt/response data structures
│
└── utils/                                # Misc utilities
    ├── file.ts                           # File I/O helpers (read/write JSON, list files, etc.)
    ├── logger.ts                         # Terminal-kit based logger with custom formatting and panels
    ├── prompts.ts                        # Loads and resolves prompt templates
    ├── text.ts                           # Text manipulation utilities (slugify, truncate, etc.)
    └── validation.ts                   # Zod-based validation schemas and helpers
```


## Logger Utility (`src/utils/logger.ts`)

This project includes a comprehensive logger utility built on top of `terminal-kit`. It provides standard logging functions as well as a rich set of interactive terminal features.

### Importing the Logger

```typescript
import logger from './src/utils/logger';
```

### Standard Logging Functions

These functions print messages to the console with a timestamp and log level.

*   `logger.info(...args: any[])`: Logs informational messages.
    ```typescript
    logger.info('System initialization complete.');
    ```
*   `logger.warn(...args: any[])`: Logs warning messages.
    ```typescript
    logger.warn('Optional configuration file not found.');
    ```
*   `logger.error(...args: any[])`: Logs error messages.
    ```typescript
    logger.error('Critical failure in data processing module.');
    ```
*   `logger.debug(...args: any[])`: Logs debug messages. These only appear if `process.env.LOG_LEVEL` is set to `'debug'` or `process.env.NODE_ENV` is `'development'`.
    ```typescript
    logger.debug('Current state:', { value: 42 });
    ```

### Rich Terminal Features

The logger exports wrappers for various `terminal-kit` functionalities.

*   `logger.term`: The raw `terminal-kit` instance. Use this to access any `terminal-kit` feature directly.
    ```typescript
    logger.term.bold.red('Direct terminal-kit access!\n');
    ```

*   `logger.drawPanel(options: PanelOptions)`: Draws a bordered panel with a title and word-wrapped content.
    *   `PanelOptions`: `{ x, y, width, height, title?, content, titleStyle?, borderStyle?, contentStyle?, padding? }`
    ```typescript
    logger.drawPanel({
      x: 5, y: 2, width: 40, height: 10,
      title: 'System Status',
      content: 'All systems operational. Ready for assimilation. Resistance is futile.',
      // titleStyle: (s) => logger.term.bgGreen.black.bold(s), // Example custom style
    });
    ```

*   `logger.table(data: any[][], options?: any)`: Displays data in a table. Refer to `terminal-kit` documentation for table options.
    ```typescript
    logger.table([
      ['ID', 'Status', 'Designation'],
      ['001', 'Active', 'Locutus'],
      ['002', 'Idle', 'Seven of Nine']
    ]);
    ```

*   `logger.createSpinner(spinnerOptions?: string | object)`: Creates and starts a spinner. Returns the spinner instance for control (`.animate()`, `.stop()`, etc. - Deprecated, spinner starts automatically. Use `logger.term.spinner()` for more control if needed, or look for specific methods on the returned object if `terminal-kit` API evolved for this wrapper). The `terminal-kit` `spinner()` function returns an object that you would typically call `start()` or `animate()` on. This wrapper calls `term.spinner()` so you'd need to handle the returned object.
    ```typescript
    const spinner = logger.createSpinner('dots'); // or logger.createSpinner({ name: 'dots', color: 'green' });
    // spinner.animate(); // If using older terminal-kit or if wrapper doesn't auto-start.
    // // some long operation
    // spinner.stop(); // Or other terminal-kit methods to stop/change it.
    // For simple cases, terminal-kit's spinner might be used like this:
    const s = logger.term.spinner();
    logger.term('Processing... ');
    setTimeout(() => s.animate(false), 2000); // Stop after 2s
    ```
    *Note: The direct `terminal-kit` API `term.spinner()` returns an object. You usually call `start()` on it or pass it to a function expecting a spinner.* The wrapper `createSpinner` calls `term.spinner()`. You'll need to manage the spinner object it returns.

*   `logger.createProgressBar(options?: any)`: Creates a progress bar. Returns the progress bar instance for control (`.update()`, `.startItem()`, etc.).
    ```typescript
    const progressBar = logger.createProgressBar({ title: 'Assimilation Progress:', width: 50 });
    progressBar.update(0.5); // 50%
    ```

*   `async logger.inputField(options?: any)`: Prompts the user for text input. Returns a promise resolving to the input string.
    ```typescript
    async function getDesignation() {
      const name = await logger.inputField({ label: 'Enter new drone designation: ' });
      logger.info(`Designation received: ${name}`);
    }
    getDesignation();
    ```

*   `async logger.yesNo(promptText: string | object, options?: any)`: Asks a yes/no question. Returns a promise resolving to a boolean.
    ```typescript
    async function confirmAssimilation() {
      const proceed = await logger.yesNo('Proceed with assimilation protocol?');
      if (proceed) {
        logger.info('Assimilation confirmed.');
      } else {
        logger.warn('Assimilation aborted by user.');
      }
    }
    confirmAssimilation();
    ```

*   `async logger.singleColumnMenu(menuItems: string[] | any[], options?: any)`: Displays a single column menu. Returns a promise resolving to an object containing the selected item's text and index.
    ```typescript
    async function selectTarget() {
      const items = ['Unimatrix 01', 'Sector 001', 'Fluidic Space'];
      const selection = await logger.singleColumnMenu(items, { header: 'Select Target:' });
      logger.info(`Target selected: ${selection.selectedText}`);
    }
    selectTarget();
    ```

*   `async logger.gridMenu(menuItems: string[] | any[], options?: any)`: Displays a grid menu. Returns a promise.
    ```typescript
    async function selectDirective() {
      const directives = ['Adapt', 'Assimilate', 'Regenerate', 'Travel'];
      const selection = await logger.gridMenu(directives); // Add options as needed
      logger.info(`Directive: ${selection.selectedText}`);
    }
    selectDirective();
    ```

*   `logger.clear()`: Clears the terminal screen.
    ```typescript
    // logger.clear();
    ```

*   `logger.moveTo(x: number, y: number, ...args: any[])`: Moves the cursor to the specified coordinates and optionally prints text.
    ```typescript
    // logger.moveTo(10, 5, 'Cursor moved.');
    ```

*   `async logger.drawImage(filePath: string, options?: any)`: Draws an image to the terminal (if supported). Returns a promise.
    ```typescript
    // For this to work, you need an image file and a compatible terminal.
    // async function displayLogo() {
    //   try {
    //     await logger.drawImage('./path/to/borg-logo.png', { shrink: { width: 40, height: 20 } });
    //     logger.info('Logo displayed.');
    //   } catch (e) {
    //     logger.error('Could not display image.', e);
    //   }
    // }
    // displayLogo();
    ```

*   `async logger.slowType(text: string, options?: any)`: Prints text with a "typewriter" effect. Returns a promise.
    ```typescript
    async function borgMessage() {
      await logger.slowType(
        'We are the Borg. Lower your shields and surrender your ships...',
        { delay: 50 }
      );
    }
    borgMessage();
    ```

### Environment Variables

*   `LOG_LEVEL`: Set to `'debug'` to enable `logger.debug()` messages. Defaults to `'info'`.
*   `NODE_ENV`: If set to `'development'`, `logger.debug()` messages are also enabled.

This logger provides a flexible and powerful interface for both simple logging and complex terminal interactions. 

## File Utility (`src/utils/file.ts`)

This utility provides a comprehensive set of asynchronous functions for interacting with the file system in a Node.js environment, using `fs/promises`.

### Importing the File Utility

```typescript
import fileUtils from './src/utils/file';
// or if your project path is different:
// import fileUtils from 'path/to/your/src/utils/file'; 
```

### File System Functions

All functions are asynchronous and return Promises.

*   `async fileUtils.readFile(filePath: string): Promise<string>`: Reads a file and returns its content as a string (UTF-8 encoded).
    ```typescript
    async function logFileContent() {
      try {
        const content = await fileUtils.readFile('./my-document.txt');
        console.log(content);
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
    logFileContent();
    ```

*   `async fileUtils.writeFile(filePath: string, data: string): Promise<void>`: Writes data to a file (UTF-8 encoded). Creates the file if it doesn't exist, overwrites it if it does.
    ```typescript
    async function saveReport() {
      try {
        await fileUtils.writeFile('./report.txt', 'System status: All clear.');
        console.log('Report saved.');
      } catch (err) {
        console.error('Failed to save report:', err);
      }
    }
    saveReport();
    ```

*   `async fileUtils.fileExists(filePath: string): Promise<boolean>`: Checks if a file or directory exists at the given path.
    ```typescript
    async function checkConfig() {
      if (await fileUtils.fileExists('./config.json')) {
        console.log('Configuration file found.');
      } else {
        console.log('Configuration file missing!');
      }
    }
    checkConfig();
    ```

*   `async fileUtils.createDirectory(dirPath: string): Promise<void>`: Creates a directory. The `recursive: true` option is used, so it also creates parent directories if they don't exist.
    ```typescript
    async function setupLogsFolder() {
      try {
        await fileUtils.createDirectory('./logs/app');
        console.log('Logs directory created.');
      } catch (err) {
        console.error('Failed to create directory:', err);
      }
    }
    setupLogsFolder();
    ```

*   `async fileUtils.deleteFile(filePath: string): Promise<void>`: Deletes a file.
    ```typescript
    async function cleanupTempFile() {
      try {
        await fileUtils.deleteFile('./temp-data.tmp');
        console.log('Temporary file deleted.');
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }
    }
    cleanupTempFile();
    ```

*   `async fileUtils.deleteDirectory(dirPath: string): Promise<void>`: Deletes a directory and its contents recursively.
    ```typescript
    async function removeOldBackup() {
      try {
        await fileUtils.deleteDirectory('./backup-2023');
        console.log('Old backup directory removed.');
      } catch (err) {
        console.error('Failed to remove backup:', err);
      }
    }
    removeOldBackup();
    ```

*   `async fileUtils.listFiles(dirPath: string): Promise<string[]>`: Lists all files (not directories) directly within the specified directory. Returns an array of file names.
    ```typescript
    async function showConfigFiles() {
      try {
        const files = await fileUtils.listFiles('./config');
        console.log('Config files:', files);
      } catch (err) {
        console.error('Failed to list config files:', err);
      }
    }
    showConfigFiles();
    ```

*   `async fileUtils.listDirectories(dirPath: string): Promise<string[]>`: Lists all subdirectories (not files) directly within the specified directory. Returns an array of directory names.
    ```typescript
    async function showUserFolders() {
      try {
        const dirs = await fileUtils.listDirectories('./users');
        console.log('User folders:', dirs);
      } catch (err) {
        console.error('Failed to list user folders:', err);
      }
    }
    showUserFolders();
    ```

## Prompt Template Utility (`src/utils/prompts.ts`)

This utility provides a function to load and process prompt template files, injecting content from specified context files into placeholders within the main template.

### Importing the Prompt Utility

```typescript
import promptUtils from './src/utils/prompts';
// or if your project path is different:
// import promptUtils from 'path/to/your/src/utils/prompts'; 
```

### Core Function

*   `async promptUtils.loadPromptTemplate(templatePath: string, contextPlaceholders: Record<string, string>, basePath: string): Promise<string>`
    *   Loads a main template file (e.g., `fine-tuning-data-sorter.txt`).
    *   Reads content from context files specified in `contextPlaceholders` (e.g., `{"PERSONA_SORTING_CONTEXT": "context/locutus/sorting_context.txt"}`).
    *   Replaces corresponding `{{PLACEHOLDER_NAME}}` tags in the main template with the content of these context files.
    *   All file paths are resolved relative to the provided `basePath`.
    *   Returns the processed template string.

    ```typescript
    async function loadMySorterPrompt() {
      try {
        const processedPrompt = await promptUtils.loadPromptTemplate(
          'templates/fine-tuning-data-sorter.txt',
          {
            'PERSONA_SORTING_CONTEXT': 'context/locutus/sorting_context.txt',
            'PERSONA_SORTING_CONDITIONS': 'context/locutus/sorting_conditions.txt'
          },
          './src/prompts' // Base path for prompt files
        );
        console.log('Processed Prompt:\n', processedPrompt);
      } catch (err) {
        console.error('Failed to load prompt template:', err);
      }
    }
    loadMySorterPrompt();
    ```

## Text Utility (`src/utils/text.ts`)

This utility provides functions for common text manipulations.

### Importing the Text Utility

```typescript
import textUtils from './src/utils/text';
// or
// import { slugify, truncate } from './src/utils/text';
```

### Functions

*   `textUtils.slugify(text: string): string`
    *   Converts a string into a URL-friendly slug (e.g., "Hello World!" becomes "hello-world").
    *   Converts to lowercase, replaces spaces and multiple hyphens with a single hyphen, and removes most special characters.
    ```typescript
    const title = "My Awesome Post Title! #amazing";
    const slug = textUtils.slugify(title);
    // slug would be "my-awesome-post-title-amazing"
    console.log(slug);
    ```

*   `textUtils.truncate(text: string, maxLength: number, ellipsis: string = '...'): string`
    *   Truncates a string to a `maxLength` if it exceeds it, appending an `ellipsis` (defaults to "...").
    *   The `maxLength` includes the length of the ellipsis.
    ```typescript
    const longText = "This is a very long string that needs to be truncated.";
    const shortText = textUtils.truncate(longText, 20);
    // shortText would be "This is a very lon..."
    console.log(shortText);

    const shorterText = textUtils.truncate(longText, 10, '--');
    // shorterText would be "This is a --"
    console.log(shorterText);
    ```

## Validation Utility (`src/utils/validation.ts`)

This utility provides Zod-based validation schemas and helper functions. Zod is a TypeScript-first schema declaration and validation library.

### Importing the Validation Utility

```typescript
import validationUtils from './src/utils/validation';
// or
// import { exampleSchema, validateData } from './src/utils/validation';
import { z } from 'zod'; // Zod itself needs to be imported for type inference
```

### Core Components

*   `validationUtils.exampleSchema`: A sample Zod schema.
    ```typescript
    // Definition in src/utils/validation.ts:
    // export const exampleSchema = z.object({
    //   name: z.string().min(1), 
    //   email: z.string().email(),
    //   age: z.number().min(0).optional(),
    // });
    ```

*   `validationUtils.validateData<T extends z.ZodTypeAny>(schema: T, data: unknown): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodIssue[] }`
    *   A generic helper function to validate arbitrary `data` against a given Zod `schema`.
    *   Returns an object indicating success or failure. If successful, `data` contains the parsed (and potentially transformed) data. If failed, `errors` contains an array of Zod issues.

    ```typescript
    const mySchema = z.object({
      id: z.string().uuid(),
      count: z.number().positive()
    });

    const validPayload = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', count: 10 };
    const result1 = validationUtils.validateData(mySchema, validPayload);
    if (result1.success) {
      console.log('Valid:', result1.data.id, result1.data.count);
    } else {
      console.error('Errors:', result1.errors);
    }

    const invalidPayload = { id: 'not-a-uuid', count: -5 };
    const result2 = validationUtils.validateData(mySchema, invalidPayload);
    if (!result2.success) {
      console.log('Invalid, as expected.');
      // result2.errors will contain details about why validation failed
      // For example: [{ code: 'invalid_string', validation: 'uuid', path: ['id'], message: 'Invalid uuid' }, ...]
      result2.errors.forEach(err => console.log(`- ${err.path.join('.')}: ${err.message}` ));
    }
    ```

## Configuration

The application uses a `config.yml` file for primary configuration and a `.env` file for sensitive information like API keys.

### `config.yml`

This file, located at the project root, defines the behavior of various application modules. It is structured as follows (refer to `src/config/config.schema.ts` for the definitive type definitions):

```yaml
logging:
  level: string # (e.g., 'info', 'debug') - Log level for the application.
  file: string # Path to the log file.
  inferred_data_file_pattern: string # Pattern for naming inferred data files.

batch_processing:
  sorter_batch_size: number # Number of items to process in each batch for the sorter.
  converter_batch_size: number # Number of items to process in each batch for the converter.
  inference_batch_size: number # Number of items to process in each batch for inference.

providers:
  google_ai_studio:
    default_model_id: string # Default model ID to use for Google AI Studio.
    apiKey: string? # Optional: Google AI Studio API Key (can also be set via GOOGLE_API_KEY env var).
    models:
      [model_id: string]: # Configuration for each specific model
        endpoint: string # API endpoint for the model.
        inference_prompt_file: string? # Optional path to a custom prompt file for this model.
        request:
          temperature: number
          maxOutputTokens: number
          topP: number
        rate_limits:
          rpm: number # Requests per minute
          tpm: number # Tokens per minute
          rpd: number # Requests per day
          inference_rpm: number? # Optional: Specific RPM for inference tasks

  openrouter: # Optional section for OpenRouter configuration
    free_models:
      [model_id: string]:
        api_key: string # API key for the model (can be overridden by OPENROUTER_API_KEY env var).
        endpoint: string # API endpoint for the model.

  together_ai: # Optional section for TogetherAI configuration
    chat:
      api_key: string # API key for TogetherAI chat (can be overridden by TOGETHER_AI_API_KEY env var).
      endpoint: string # API endpoint for TogetherAI chat.

```

### `.env` File

This file, also at the project root, should store your API keys and any other sensitive or environment-specific settings. It is loaded at runtime and its values take precedence over any API keys defined in `config.yml`.

Example `.env` structure:

```env
# Google AI Studio API Key (Optional if using Application Default Credentials)
GOOGLE_API_KEY="your_google_api_key_here"

# OpenRouter API Key (Required if using OpenRouter models)
OPENROUTER_API_KEY="your_openrouter_api_key_here"

# TogetherAI API Key (Required if using TogetherAI chat)
TOGETHER_AI_API_KEY="your_together_ai_api_key_here"

# Logging Configuration (Overrides logger.info messages if not in development)
LOG_LEVEL="debug" # e.g., 'debug', 'info', 'warn', 'error' (also enables debug if NODE_ENV='development')
NODE_ENV="development" # e.g., 'development', 'production'
```

**Important:**
*   Ensure `.env` is listed in your `.gitignore` file to prevent committing sensitive keys to your repository.
*   The application will warn or error if required API keys are missing (either from `.env` or `config.yml` if not overridden by an environment variable).