/**
 * Represents a single cue (dialogue line) in a transcript
 */
export interface TranscriptCue {
  /** The original raw line from the transcript, potentially combined from multiple lines */
  raw: string;
  /** The character name for dialogue. This is used in the output format. */
  character?: string;
}

/**
 * Configuration for transcript search
 */
export interface TranscriptSearchConfig {
  /** The regex pattern to match character names (e.g. 'PICARD|LOCUTUS') */
  pattern: string;
  /** Number of context cues to retrieve before and after the matched cue. Defaults to 0. */
  contextLines?: number;
}

/**
 * Represents a matched cue along with its surrounding context.
 */
export interface CueWithContext {
  cue: TranscriptCue;
  before: TranscriptCue[];
  after: TranscriptCue[];
}

/**
 * Results from a transcript search
 */
export interface TranscriptSearchResult {
  /** The matched cues, each with its context */
  cues: CueWithContext[];
  /** The total number of matches found */
  total: number;
  /** The search pattern that was used */
  pattern: string;
  /** The number of context lines that were retrieved for each cue, if requested. */
  contextLinesUsed?: number;
}

/**
 * Cache configuration for storing parsed transcripts
 */
export interface TranscriptCache {
  /** Directory to store cached results */
  cacheDir: string;
  /** Whether to use caching */
  enabled: boolean;
}

