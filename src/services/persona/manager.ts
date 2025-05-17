import logger from '../../utils/logger';
import { TranscriptParser } from '../transcript/parser';
import path from 'path';
import { TranscriptSearchConfig, TranscriptSearchResult } from '../transcript/types';
import File from '../../utils/file';
import { GeminiClient } from '../llm/geminiClient';

const MODULE_NAME = 'PersonaManager';

export class PersonaManager {
  private transcriptParser: TranscriptParser;
  public name: string;
  private _dataDir: string;
  private _rawDir: string;
  private _sortedDir: string;
  private _convertedDir: string;
  private _inferDir: string;
  private _client: GeminiClient;

  constructor(name: string, client: GeminiClient) {
    this._client = client;
    this.name = name;

    logger.info(MODULE_NAME, `Initializing persona: ${name}`);
    this.transcriptParser = new TranscriptParser('../../../transcripts');

    this._dataDir = path.join(__dirname, '../../../data');
    this._rawDir = path.join(this._dataDir, 'raw', this.name);
    this._sortedDir = path.join(this._dataDir, 'sorted', this.name);
    this._convertedDir = path.join(this._dataDir, 'converted', this.name);
    this._inferDir = path.join(this._dataDir, 'inferred', this.name);
    logger.debug(MODULE_NAME, `Data directories configured for ${this.name}: raw: ${this._rawDir}, sorted: ${this._sortedDir}, converted: ${this._convertedDir}, inferred: ${this._inferDir}`);

    logger.info(MODULE_NAME, `Persona ${name} initialized successfully.`);
  }

  public async searchDialog(pattern: string, contextLines: number = 0): Promise<TranscriptSearchResult> {
    return this.transcriptParser.searchDialog({ pattern, contextLines });
  }

  
}