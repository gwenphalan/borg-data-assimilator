import terminalKit from 'terminal-kit';

const term = terminalKit.terminal;

// BORG Colors
const BORG_BRIGHT_GREEN = term.brightGreen;
const BORG_GREEN = term.green;
// const BORG_DIM_GREEN = term.green; // Using regular green for less emphasis
const BORG_YELLOW = term.yellow;
const BORG_RED = term.red;
const BORG_CYAN_FOR_TIMESTAMP = term.cyan;
const BORG_LIGHT_GREY_FOR_TIMESTAMP = term.brightBlack;
const BORG_WHITE_FOR_MESSAGE = term.white;
const BORG_MAGENTA_FOR_MODULE = term.magenta; // New color for module prefix

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_DEBUG_MODE = LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development';

const getTimestamp = () => {
  return new Date().toLocaleTimeString();
};

const info = (...args: any[]) => {
  let moduleName: string | null = null;
  let messageArgs = [...args];
  if (args.length > 1 && typeof args[0] === 'string') {
    moduleName = args[0];
    messageArgs = args.slice(1);
  }
  BORG_LIGHT_GREY_FOR_TIMESTAMP(`[${getTimestamp()}] `);
  BORG_BRIGHT_GREEN.bold('[INFO] ');
  if (moduleName) {
    BORG_MAGENTA_FOR_MODULE(`[${moduleName}] `);
  }
  BORG_WHITE_FOR_MESSAGE(...messageArgs);
  term('\n');
};

const warn = (...args: any[]) => {
  let moduleName: string | null = null;
  let messageArgs = [...args];
  if (args.length > 1 && typeof args[0] === 'string') {
    moduleName = args[0];
    messageArgs = args.slice(1);
  }
  BORG_LIGHT_GREY_FOR_TIMESTAMP(`[${getTimestamp()}] `);
  BORG_YELLOW.bold('[WARN] ');
  if (moduleName) {
    BORG_MAGENTA_FOR_MODULE(`[${moduleName}] `);
  }
  BORG_WHITE_FOR_MESSAGE(...messageArgs);
  term('\n');
};

const error = (...args: any[]) => {
  let moduleName: string | null = null;
  let messageArgs = [...args];
  if (args.length > 1 && typeof args[0] === 'string') {
    moduleName = args[0];
    messageArgs = args.slice(1);
  }
  BORG_LIGHT_GREY_FOR_TIMESTAMP(`[${getTimestamp()}] `);
  BORG_RED.bold('[ERROR] ');
  if (moduleName) {
    BORG_MAGENTA_FOR_MODULE(`[${moduleName}] `);
  }
  BORG_WHITE_FOR_MESSAGE.bold(...messageArgs); // Error messages are bold
  term('\n');
};

const debug = (...args: any[]) => {
  if (IS_DEBUG_MODE) {
    let moduleName: string | null = null;
    let messageArgs = [...args];
    if (args.length > 1 && typeof args[0] === 'string') {
      moduleName = args[0];
      messageArgs = args.slice(1);
    }
    BORG_LIGHT_GREY_FOR_TIMESTAMP(`[${getTimestamp()}] `);
    BORG_GREEN.bold('[DEBUG] ');
    if (moduleName) {
      BORG_MAGENTA_FOR_MODULE(`[${moduleName}] `);
    }
    BORG_WHITE_FOR_MESSAGE(...messageArgs);
    term('\n');
  }
};

interface PanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  content: string;
  titleStyle?: (str: string) => any;
  borderStyle?: (str: string) => any;
  contentStyle?: (str: string) => any;
  padding?: number;
}

const drawPanel = (options: PanelOptions) => {
  const {
    x, y, width, height,
    title = '',
    content,
    titleStyle = (s: string) => BORG_BRIGHT_GREEN.bold(s),
    borderStyle = (s: string) => BORG_BRIGHT_GREEN(s),
    contentStyle = (s: string) => BORG_BRIGHT_GREEN(s),
    padding = 1,
  } = options;

  for (let i = 0; i < height; i++) {
    term.moveTo(x, y + i)(' '.repeat(width));
  }

  term.moveTo(x, y);
  borderStyle('┌' + '─'.repeat(width - 2) + '┐');
  for (let i = 1; i < height - 1; i++) {
    term.moveTo(x, y + i);
    borderStyle('│');
    term.moveTo(x + width - 1, y + i);
    borderStyle('│');
  }
  term.moveTo(x, y + height - 1);
  borderStyle('└' + '─'.repeat(width - 2) + '┘');

  if (title) {
    const titlePaddingChars = 1;
    const availableTitleWidth = width - 2 * titlePaddingChars;
    const trimmedTitle = title.length > availableTitleWidth ? title.substring(0, availableTitleWidth - 3) + '...' : title;
    const titleStartX = x + Math.max(titlePaddingChars, Math.floor((width - trimmedTitle.length) / 2));
    term.moveTo(titleStartX, y);
    titleStyle(trimmedTitle);
  }

  const contentStartX = x + 1 + padding;
  const contentStartY = y + 1 + padding;
  const contentRenderWidth = width - 2 * (1 + padding);
  const contentRenderHeight = height - 2 * (1 + padding);

  if (contentRenderWidth > 0 && contentRenderHeight > 0) {
    const words = content.split(' ');
    let currentLine = '';
    const lines: string[] = [];
    for (const word of words) {
      if (currentLine.length + word.length + (currentLine.length > 0 ? 1 : 0) <= contentRenderWidth) {
        if (currentLine.length > 0) currentLine += ' ';
        currentLine += word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    for (let i = 0; i < Math.min(lines.length, contentRenderHeight); i++) {
      term.moveTo(contentStartX, contentStartY + i);
      contentStyle(lines[i]);
    }
  }
};

const table = (data: any[][], options?: any) => term.table(data, options);

// Correcting types based on typical terminal-kit structure and linter hints
// Note: Specific type names like terminalKit.Terminal.SpinnerOptions might vary slightly across minor versions
// or if global types are augmented. For now, using direct type from term object if possible or common patterns.

const createSpinner = (spinnerOptions?: string | terminalKit.Terminal.AnimatedTextOptions) => {
  // The type Terminal.SpinnerOptions might be terminalKit.SpinnerOptions or similar.
  // If string, it refers to SpinnerType e.g. 'dots'
  if (typeof spinnerOptions === 'string') {
    return term.spinner(spinnerOptions as terminalKit.Terminal.AnimationOption); // Use AnimationOption for string input
  } else if (spinnerOptions && typeof spinnerOptions === 'object') {
    return term.spinner(spinnerOptions); // spinnerOptions is AnimatedTextOptions
  }
  return term.spinner(); // Default spinner
};

const createProgressBar = (options?: terminalKit.Terminal.ProgressBarOptions) => term.progressBar(options);

const inputField = (options?: terminalKit.Terminal.InputFieldOptions): Promise<string | undefined> => {
  const field = term.inputField(options);
  return field.promise; // InputField controller has a .promise
};

const yesNo = async (promptText: string | terminalKit.Terminal.YesOrNoOptions, options?: terminalKit.Terminal.YesOrNoOptions): Promise<boolean | undefined> => {
  let actualOptions: terminalKit.Terminal.YesOrNoOptions;
  let promise: Promise<boolean> | undefined;

  if (typeof promptText === 'string') {
    term(promptText + ' '); // Display the question text separately
    actualOptions = { yes: [ 'y' , 'ENTER' ], no: [ 'n' ], ...(options || {}) };
    const ynController = term.yesOrNo(actualOptions);
    promise = ynController.promise;
  } else {
    // promptText is already YesOrNoOptions
    actualOptions = promptText; // Note: options argument is ignored in this case by original logic
    const ynController = term.yesOrNo(actualOptions);
    promise = ynController.promise;
  }

  if (promise) {
    return await promise;
  }
  return undefined; // Should ideally not happen if term.yesOrNo behaves as expected
};

const singleColumnMenu = (menuItems: any[] | terminalKit.Terminal.SingleColumnMenuOptions, options?: terminalKit.Terminal.SingleColumnMenuOptions): Promise<terminalKit.Terminal.SingleColumnMenuResponse | undefined> => {
  // The type definition for singleColumnMenu expects menuItems as readonly string[] if options are separate.
  // If menuItems IS the options object, it should be SingleColumnMenuOptions.
  // The current 'any[]' might lead to runtime issues if not string[].
  // Casting to 'any' for now to preserve original flexibility, but this could be a typing smell.
  const menu = term.singleColumnMenu(menuItems as any, options);
  return menu.promise;
};

const gridMenu = (menuItems: any[] | terminalKit.Terminal.GridMenuOptions, options?: terminalKit.Terminal.GridMenuOptions): Promise<terminalKit.Terminal.GridMenuResponse | undefined> => {
  const menu = term.gridMenu(menuItems as any, options);
  return menu.promise;
};

const clear = () => term.clear();
const moveTo = (targetX: number, targetY: number, ...args: any[]) => term.moveTo(targetX, targetY, ...args);

// Use the inline type for DrawImageOptions as per Terminal.d.ts
const drawImage = (filePath: string, options?: { shrink?: { width: number; height: number; } | undefined; }): Promise<void> => {
  const result = term.drawImage(filePath, options);
  return Promise.resolve(result); // Ensure it's always a promise
};

// For slowTyping, options type is typically terminalKit.Terminal.AnimatedTextOptions or a simpler object for delay/style.
// The error suggested AnimatedTextOptions was wrong. Let's try the simpler options structure for slowTyping based on common usage.
// Terminal.d.ts shows: slowTyping(str: string, options?: { style?: CTerminal | undefined; flashStyle?: CTerminal | undefined; delay?: number | undefined; flashDelay?: number | undefined; })
type SlowTypingOptions = { style?: terminalKit.Terminal, delay?: number, flashStyle?: terminalKit.Terminal, flashDelay?: number };

const slowType = (text: string, options?: SlowTypingOptions): Promise<void> => {
  BORG_BRIGHT_GREEN();
  const animationPromise = term.slowTyping(text, options);
  return Promise.resolve(animationPromise).finally(() => term.styleReset());
};

export default {
  info,
  warn,
  error,
  debug,
  term,
  drawPanel,
  table,
  createSpinner,
  createProgressBar,
  inputField,
  yesNo,
  singleColumnMenu,
  gridMenu,
  clear,
  moveTo,
  drawImage,
  slowType,
};
