import path from 'path';
import fileUtils from '../../utils/file';
import logger from '../../utils/logger';
import { TranscriptCue, TranscriptSearchConfig, TranscriptSearchResult, CueWithContext } from './types';
import { ICacheService, CacheService } from '../cache';

// Define parts for the CUE_START speaker pattern helper constants
const SPEAKER_CORE_CHARSET = '[A-Z0-9\s,\'\-.()]'; // Core characters for a name, including literal parentheses
const SPEAKER_BASE_NAME = `[A-Z]${SPEAKER_CORE_CHARSET}*`; // Starts with a capital, then typical name chars
const OPTIONAL_PAREN_ANNOTATION = '(?:\s*\([^)]*?\))?'; // Optional suffix like "(V.O.)"
const OPTIONAL_BRACKET_ANNOTATION = '(?:\s*\[[^\]]*?\])?'; // Optional suffix like "[OC]"

// Combined speaker capture group string - THIS IS NOT THE CAPTURE, BUT THE PATTERN FOR IT.
const SPEAKER_TAG_PATTERN_STRING = `${SPEAKER_BASE_NAME}${OPTIONAL_PAREN_ANNOTATION}${OPTIONAL_BRACKET_ANNOTATION}`;

/**
 * Regular expressions for parsing transcripts
 * Sourced from REGEX.md
 */
const REGEX = {
  // Matches character dialogue lines like "PICARD: Make it so"
  CHARACTER_LINE: new RegExp('^\\s*([A-Z][A-Z0-9\s,\'\-]*(?:\\s*\\([^)]*?\\))?):|\\([^)]*?\\)|\\\[.*?\\\]|(?:Stardate|Captain\'s log|Original Airdate):'),

  // SCENE_HEADER: Matches lines like "  1   A BLACK VOID          1" capturing "A BLACK VOID"
  // Fixes: Escapes hyphen in character class if not at start/end. Uses broader match for scene text.
  SCENE_HEADER: new RegExp('^\\s*\\d+\\s+(.+?)\\s+\\d+\\s*$'),

  // MOVIE_LINE: Matches lines that are typically skipped like "1 OMITTED 1" or just numbers for scene markers not covered by SCENE_HEADER
  // This pattern looks correct for its stated purpose.
  MOVIE_LINE: new RegExp('^\\s*(?:\\d+\\s+OMITTED(?:\\s+\\d+)?|\\d+)\\s*$'),
  
  // Matches transcript footers
  FOOTER: new RegExp('^\\s*<Back to the episode listing'),

  // Matches the start of a cue (dialogue, action, log entry, bracketed action)
  CUE_START: new RegExp(
    '^\\s*(?:(?:(?:\\([^)]*?\\)\\s*)?(' + SPEAKER_TAG_PATTERN_STRING + ')\\s*:)|(?:\\(([^)]*?)\\))|(?:\\\[(.*?)\\])|(?:((?:Stardate|Captain\\\'s log|Original Airdate):)))'
  ),

  // Matches movie script speaker names with indentation
  // Fixes: Correctly escapes the single quote in `\'S` for the string literal. The character class `[A-Z0-9\\s\\'.]` seems correct to include letters, numbers, whitespace, single quote, and literal dot.
  MOVIE_SPEAKER: new RegExp('^\\s{10,}([A-Z][A-Z0-9\\s\\\'\\.]*(?:\\([A-Z\\s\\.]+\\))?(?:\\\'S\\sVOICE)?)\\s*$'), // Escaped single quote in character class and dot, although dot doesn't strictly need it in []

  // Matches and strips character prefixes from lines
  // Fixes: Escapes the hyphen in the character class if not at start/end. Escapes `[` and `]` correctly.
  CHARACTER_PREFIX: new RegExp('^[A-Z .\\\'\\-]+(?:\\s*\\\[[^\\\]]*\\\])?\\s*[:]{1,2}\\\\s*'), // Escaped single quote and hyphen in character class

  // Matches common credit lines to be skipped
  CREDIT_LINE: /^(?:\s*\[null\]\s*)?(?:Story by|Screenplay by|Written by|Directed by|Produced by|Executive Producer|Co-Executive Producer|Associate Producer|Consulting Producer|Teleplay by|First Draft|Original Airdate:|Airdate:|Captain\'s log, supplemental|Stardate.*\d+\.\d+|basée sur une idée originale|une coproduction de|adapté par|dialogues de|scénario et dialogues|September 29, 1995|copyright|all rights reserved|transcribed by|credits? and transcriptions by)/i
};

/**
 * Represents the state during the parsing of a transcript.
 */
interface ParsingState {
  cues: TranscriptCue[];
  currentCue: Partial<TranscriptCue> | null;
  pendingMovieSpeaker: string | null;
  currentSceneContext: string | null;
}

const PARSER_MODULE_NAME = "TranscriptParser";
const TRANSCRIPT_CACHE_NAMESPACE = "transcripts";

export class TranscriptParser {
  private cacheService: ICacheService; // No longer undefined
  private transcriptDir: string;

  constructor(transcriptDir: string) {
    this.transcriptDir = transcriptDir;
    const retrievedCacheService = CacheService.getService(TRANSCRIPT_CACHE_NAMESPACE);

    if (!retrievedCacheService) {
      logger.error(PARSER_MODULE_NAME, `CRITICAL: CacheService for namespace "${TRANSCRIPT_CACHE_NAMESPACE}" not found. This service is mandatory. Ensure initializeSharedCacheServices() has been called and registered this namespace.`);
      throw new Error(`TranscriptParser: Critical dependency CacheService "${TRANSCRIPT_CACHE_NAMESPACE}" is not registered.`);
    }
    this.cacheService = retrievedCacheService;
    logger.info(PARSER_MODULE_NAME, `Initialized with transcript directory: ${transcriptDir}. Using mandatory cache service for namespace "${TRANSCRIPT_CACHE_NAMESPACE}".`);
  }

  /**
   * Finalizes the current cue and adds it to the list of cues.
   * Modifies the state directly.
   * @param state - The current parsing state.
   */
  private _finalizeAndAddCue(state: ParsingState): void {
    if (state.currentCue && state.currentCue.raw && state.currentCue.raw.trim()) {
      let rawText = state.currentCue.raw.trim();
      const characterToUse = state.currentCue.character && state.currentCue.character.trim() ? state.currentCue.character.trim() : undefined;
      let cueToAdd: TranscriptCue | null = null;

      // Strip [null] prefix if present
      if (rawText.startsWith('[null] ')) {
        rawText = rawText.substring('[null] '.length);
      }
      // Also handle if it's just "[null]"
      if (rawText === '[null]') {
        rawText = '';
      }
      if (!rawText && !characterToUse) {
        state.currentCue = null;
        return; // Don't add empty cues after stripping [null]
      }

      if (characterToUse) {
        // Dialogue
        let dialogueSegment = rawText;
        // If state.currentCue.raw (which became rawText) already starts with "CHARACTER: ", extract just the dialogue part
        if (rawText.toUpperCase().startsWith(`${characterToUse.toUpperCase()}:`)) {
          dialogueSegment = rawText.substring(characterToUse.length + 1).trim();
        }
        
        cueToAdd = {
          raw: `${characterToUse}: ${dialogueSegment}`,
          character: characterToUse
        };
        state.currentSceneContext = null; // Dialogue consumes/clears any active scene context
      } else {
        // Scene description or action line
        let sceneContextEffectivelyApplied = false;
        if (state.currentSceneContext) {
          const isSelfContainedBracket = rawText.startsWith('[') && rawText.endsWith(']');
          
          if (isSelfContainedBracket && rawText.toUpperCase() === `[${state.currentSceneContext.toUpperCase()}]`) {
            // The line itself IS the current scene context (e.g. line is "[INT. HALLWAY]" and state.currentSceneContext is "INT. HALLWAY")
            // rawText is already correct. Mark context as applied to consume it.
            sceneContextEffectivelyApplied = true;
          } else if (!isSelfContainedBracket) {
            // Not a self-contained bracket. Prepend scene context if not already there from a multi-line description.
            if (!rawText.toUpperCase().startsWith(`[${state.currentSceneContext.toUpperCase()}]`)) {
               rawText = `[${state.currentSceneContext}] ${rawText}`;
            }
            // Scene context remains active for subsequent description lines unless cleared by dialogue or new scene header.
          }
        }
        cueToAdd = { raw: rawText };

        if (sceneContextEffectivelyApplied) { // Only if the line ITSELF was the scene context in brackets
            state.currentSceneContext = null;
        }
      }

      if (cueToAdd && cueToAdd.raw.trim()) { // Ensure cue is not empty after processing
        state.cues.push(cueToAdd);
        logger.debug(PARSER_MODULE_NAME, "Finalized and added cue:", JSON.stringify(cueToAdd));
      }
    }
    state.currentCue = null;
  }

  /**
   * Processes a single line from the transcript and updates the parsing state.
   * @param originalLine - The original line content.
   * @param trimmedLine - The line content, trimmed of whitespace.
   * @param state - The current parsing state.
   */
  private _processLine(originalLine: string, trimmedLine: string, state: ParsingState): void {
    // Prioritize credit line check
    if (REGEX.CREDIT_LINE.test(trimmedLine)) {
      logger.debug(PARSER_MODULE_NAME, "Matched credit line, skipping.", trimmedLine);
      this._finalizeAndAddCue(state);
      state.currentCue = null;
      state.pendingMovieSpeaker = null;
      state.currentSceneContext = null;
      return;
    }

    // Skip footers, empty lines, or specific movie lines
    if (!trimmedLine || REGEX.FOOTER.test(originalLine) || REGEX.MOVIE_LINE.test(originalLine)) {
      logger.debug(PARSER_MODULE_NAME, "Matched footer, empty or movie line, skipping.", originalLine);
      this._finalizeAndAddCue(state);
      state.currentCue = null;
      // pendingMovieSpeaker and currentSceneContext intentionally not nulled here
      return;
    }

    const sceneHeaderMatch = trimmedLine.match(REGEX.SCENE_HEADER);
    if (sceneHeaderMatch) {
      this._finalizeAndAddCue(state);
      state.pendingMovieSpeaker = null;
      state.currentSceneContext = sceneHeaderMatch[1].trim().replace(/\s\s+/g, ' ');
      logger.debug(PARSER_MODULE_NAME, "Matched scene header:", state.currentSceneContext);
      state.currentCue = null;
      return;
    }

    // Test MOVIE_SPEAKER against the original line
    const movieSpeakerMatch = originalLine.match(REGEX.MOVIE_SPEAKER);
    if (movieSpeakerMatch) {
      this._finalizeAndAddCue(state);
      state.pendingMovieSpeaker = movieSpeakerMatch[1].trim();
      logger.debug(PARSER_MODULE_NAME, "Matched movie speaker:", state.pendingMovieSpeaker);
      state.currentCue = null;
      return;
    }

    const cueStartMatch = trimmedLine.match(REGEX.CUE_START);
    if (cueStartMatch) {
      this._finalizeAndAddCue(state);
      const matchedCharacterName = cueStartMatch[1] ? cueStartMatch[1].trim() : undefined;
      state.currentCue = { character: matchedCharacterName, raw: trimmedLine };
      state.pendingMovieSpeaker = null;
      logger.debug(PARSER_MODULE_NAME, `Matched cue start. Speaker: ${matchedCharacterName || 'N/A'}`, trimmedLine);
    } else {
      // Continuation or new stage direction
      if (state.pendingMovieSpeaker) {
        this._finalizeAndAddCue(state);
        state.currentCue = { character: state.pendingMovieSpeaker, raw: trimmedLine };
        logger.debug(PARSER_MODULE_NAME, "Applying pending movie speaker:", state.pendingMovieSpeaker, "to line:", trimmedLine);
        state.pendingMovieSpeaker = null;
      } else if (state.currentCue) {
        state.currentCue.raw += " " + trimmedLine;
        logger.debug(PARSER_MODULE_NAME, "Continuing current cue with line:", trimmedLine);
      } else {
        this._finalizeAndAddCue(state); // Should do nothing if currentCue is null
        state.currentCue = { character: undefined, raw: trimmedLine };
        logger.debug(PARSER_MODULE_NAME, "Started new stage direction/descriptive text:", trimmedLine);
      }
    }
  }

  /**
   * Parses a transcript file into an array of cues.
   * Each cue is an object with `raw` (the full line or combined lines of the cue) and `speaker`.
   * Handles both TV show transcript formats and movie script formats (indented speakers).
   * Multi-line dialogues are concatenated into a single `raw` string with spaces.
   * @param filePath - The path to the transcript file.
   * @returns A promise that resolves to an array of transcript cues (objects with `raw` and `speaker` strings).
   */
  public async parseTranscript(filePath: string): Promise<TranscriptCue[]> {
    const cacheKey = path.basename(filePath);
    logger.info(PARSER_MODULE_NAME, `Attempting to parse transcript: ${filePath} (cache key for service: ${cacheKey})`);

    try {
      const cachedCues = await this.cacheService.get<TranscriptCue[]>(cacheKey);
      if (cachedCues) {
        logger.debug(PARSER_MODULE_NAME, `Cache hit for: ${cacheKey}. Returning cached data.`);
        return cachedCues;
      }
      logger.debug(PARSER_MODULE_NAME, `Cache miss for: ${cacheKey}. Proceeding with parsing.`);
    } catch (err) {
      logger.warn(PARSER_MODULE_NAME, `Error during cache get for key ${cacheKey} (will attempt to parse fresh):`, err);
      // Proceed to parse as if it's a miss, but log the cache error
    }

    logger.debug(PARSER_MODULE_NAME, `Reading transcript file content: ${filePath}`);
    const content = await fileUtils.readFile(filePath);
    const lines = content.split('\n');
    
    const state: ParsingState = {
      cues: [],
      currentCue: null,
      pendingMovieSpeaker: null,
      currentSceneContext: null,
    };

    for (const line of lines) {
      this._processLine(line, line.trim(), state);
    }
    this._finalizeAndAddCue(state); // Add the very last cue

    try {
      await this.cacheService.set(cacheKey, state.cues);
      logger.info(PARSER_MODULE_NAME, `Successfully cached parsed cues for key: ${cacheKey}.`);
    } catch (error) {
      logger.error(PARSER_MODULE_NAME, `Failed to write to cache for key ${cacheKey}:`, error);
      // Do not re-throw; parsing was successful, caching is secondary but attempted.
    }

    logger.info(PARSER_MODULE_NAME, `Finished parsing transcript: ${filePath}. Cues generated: ${state.cues.length}`);
    return state.cues;
  }

  /**
   * Generic helper to search cues based on a filter function.
   * Iterates through all transcript files, parses them, and applies the filter.
   * @param filterFn - A function that takes a cue (now {raw, speaker}) and returns true if it matches.
   * @returns A promise that resolves to an array of matching transcript cues.
   */
  private async _searchCuesByFilter(
    filterFn: (cue: TranscriptCue) => boolean,
    contextLines: number = 0
  ): Promise<CueWithContext[]> {
    const allMatchingCuesWithContext: CueWithContext[] = [];
    const transcriptFiles = await this.getTranscriptFiles(this.transcriptDir);
    const numContextLines = Math.max(0, contextLines); // Ensure non-negative

    for (const file of transcriptFiles) {
      const fileCues = await this.parseTranscript(file);
      
      fileCues.forEach((cue, index) => {
        if (filterFn(cue)) {
          const beforeStart = Math.max(0, index - numContextLines);
          const beforeContext = fileCues.slice(beforeStart, index);
          
          const afterEnd = Math.min(fileCues.length, index + 1 + numContextLines);
          const afterContext = fileCues.slice(index + 1, afterEnd);
          
          allMatchingCuesWithContext.push({ 
            cue: cue,
            before: beforeContext, 
            after: afterContext 
          });
        }
      });
    }
    return allMatchingCuesWithContext;
  }

  /**
   * Searches for dialogue cues by matching a character name pattern.
   * The pattern is tested against the `cue.character` property of each cue.
   * It expects the pattern to be the base character name, and will match if
   * `cue.character` consists of this base name, optionally followed by
   * parenthesized and/or bracketed annotations (e.g., "(V.O.)", "[on screen]").
   * @param config - The search configuration, including the pattern and optional contextLines.
   * @returns A promise that resolves to the search results.
   */
  public async searchDialog(config: TranscriptSearchConfig): Promise<TranscriptSearchResult> {
    const regexPattern = new RegExp(`^(${config.pattern})(?:\s*\([^)]*?\))?(?:\s*\[[^\]]*?\])?$`, 'i');
    
    const filterFn = (cue: TranscriptCue): boolean => {
      if (!cue.character) return false;
      return regexPattern.test(cue.character);
    }
    const matchedCuesWithContext = await this._searchCuesByFilter(filterFn, config.contextLines);

    return {
      cues: matchedCuesWithContext,
      total: matchedCuesWithContext.length,
      pattern: config.pattern,
      contextLinesUsed: config.contextLines
    };
  }

  /**
   * Extracts the textual content from a cue, stripping speaker prefixes if applicable.
   * @param cue - The transcript cue.
   * @returns The textual content of the cue.
   */
  private static _extractTextFromCue(cue: TranscriptCue): string {
    let textContent = cue.raw;
    if (cue.character) { // Changed from cue.speaker to cue.character to match TranscriptCue type
      const expectedPrefix = cue.character + ":";
      if (textContent.toUpperCase().startsWith(expectedPrefix.toUpperCase())) { // Case-insensitive check for prefix
        textContent = textContent.substring(expectedPrefix.length).trim();
      }
      // If cue.character was set (e.g., by MOVIE_SPEAKER context) and cue.raw does not 
      // start with the prefix, cue.raw is assumed to be the direct dialogue text already.
    }
    // For cues with no character (e.g., action lines), textContent is simply cue.raw.
    return textContent;
  }

  /**
   * Searches for keywords within the dialogue text of cues.
   * The keyword is tested against the textual content of the cue, deriving it from `raw` and `character`.
   * @param config - The search configuration, including the keyword (as pattern) and optional contextLines.
   * @returns A promise that resolves to the search results.
   */
  public async searchKeyword(config: TranscriptSearchConfig): Promise<TranscriptSearchResult> {
    const pattern = new RegExp(config.pattern, 'i');

    const filterFn = (cue: TranscriptCue): boolean => {
      const textContent = TranscriptParser._extractTextFromCue(cue);
      return pattern.test(textContent);
    };
    const matchedCuesWithContext = await this._searchCuesByFilter(filterFn, config.contextLines);
    
    return {
      cues: matchedCuesWithContext,
      total: matchedCuesWithContext.length,
      pattern: config.pattern,
      contextLinesUsed: config.contextLines
    };
  }

  /**
   * Recursively gets all transcript files (ending with '.txt') from a given directory.
   * @param dir - The directory to search.
   * @returns A promise that resolves to an array of full transcript file paths.
   */
  public async getTranscriptFiles(dir: string): Promise<string[]> {
    logger.info(PARSER_MODULE_NAME, `Getting transcript files from directory: ${dir}`);
    try {
      const allFiles = await fileUtils.listFilesRecursive(dir);
      logger.debug(PARSER_MODULE_NAME, `Found ${allFiles.length} total files/folders in ${dir}. Filtering for .txt files.`);
      const txtFiles = allFiles.filter(file => file.endsWith('.txt'));
      logger.info(PARSER_MODULE_NAME, `Found ${txtFiles.length} .txt transcript files in ${dir}.`);
      return txtFiles;
    } catch (error) {
      logger.error(PARSER_MODULE_NAME, `Error getting transcript files from directory ${dir}:`, error);
      return []; 
    }
  }
}
