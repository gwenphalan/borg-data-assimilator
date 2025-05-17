import logger from '../utils/logger';
import fileUtils from '../utils/file';
import * as crypto from 'crypto';
import * as path from 'path';

const MODULE_NAME = "CacheService";

/**
 * Interface for a cached item, storing its value and optional expiry timestamp.
 */
interface CacheItem<T> {
  value: T;
  expiry?: number; // Timestamp in milliseconds when the item expires
}

/**
 * Configuration for persistent caching.
 */
export interface PersistentCacheConfig {
  basePath: string;
}

/**
 * Defines the contract for a cache service.
 */
export interface ICacheService {
  getNamespace(): string; // Added getter for namespace
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clearNamespace(): Promise<void>;
}

/**
 * An in-memory cache service implementation that supports namespacing, TTL, and optional file-based persistence.
 * Instances can be registered and retrieved globally via static methods.
 */
export class CacheService implements ICacheService {
  private static registry = new Map<string, ICacheService>();

  private store = new Map<string, CacheItem<any>>();
  private namespace: string;
  private defaultTtlSeconds?: number;
  private persistentCacheEnabled: boolean = false;
  private persistentCachePath?: string;

  /**
   * Creates an instance of the CacheService. The instance is automatically registered globally.
   * @param namespace A unique namespace for this cache instance.
   * @param defaultTtlSeconds Optional. Default time-to-live for items in seconds.
   * @param persistentConfig Optional. Configuration for enabling persistent file-based cache.
   */
  constructor(namespace: string, defaultTtlSeconds?: number, persistentConfig?: PersistentCacheConfig) {
    if (!namespace || namespace.trim() === "") {
      logger.error(MODULE_NAME, "CacheService namespace cannot be empty.");
      throw new Error("CacheService: Namespace cannot be empty.");
    }
    this.namespace = namespace.trim();
    this.defaultTtlSeconds = defaultTtlSeconds;

    let logMessage = `Instance created for namespace "${this.namespace}" with default TTL ${this.defaultTtlSeconds ? this.defaultTtlSeconds + 's' : 'none'}.`;

    if (persistentConfig?.basePath) {
      try {
        this.persistentCachePath = path.join(persistentConfig.basePath, this.namespace);
        fileUtils.createDirectory(this.persistentCachePath);
        this.persistentCacheEnabled = true;
        logMessage += ` Persistent cache ENABLED at: ${this.persistentCachePath}`;
      } catch (error) {
        logger.error(MODULE_NAME, `[${this.namespace}] Failed to initialize persistent cache directory at ${this.persistentCachePath || persistentConfig.basePath + '/' + this.namespace}:`, error);
        this.persistentCachePath = undefined;
        this.persistentCacheEnabled = false;
        logMessage += ` Persistent cache init FAILED.`;
      }
    }
    logger.info(MODULE_NAME, logMessage); // Log instance creation details first

    // Register the instance globally
    CacheService.registry.set(this.namespace, this);
    logger.info(MODULE_NAME, `Service instance for namespace "${this.namespace}" registered globally.`);
  }

  /**
   * Retrieves the namespace of this cache service instance.
   * @returns The namespace string.
   */
  public getNamespace(): string {
    return this.namespace;
  }

  /**
   * Retrieves a registered CacheService instance by its namespace.
   * @param namespace The namespace of the service to retrieve.
   * @returns The ICacheService instance, or undefined if not found.
   */
  public static getService(namespace: string): ICacheService | undefined {
    const service = CacheService.registry.get(namespace);
    if (service) {
      logger.debug(MODULE_NAME, `Retrieved registered cache service for namespace "${namespace}".`);
    } else {
      logger.warn(MODULE_NAME, `No cache service found registered for namespace "${namespace}".`);
    }
    return service;
  }
  
  /**
   * Clears all items from all registered cache service namespaces (both in-memory and persistent stores).
   */
  public static async clearAllRegisteredCaches(): Promise<void> {
    logger.info(MODULE_NAME, "Attempting to clear all registered caches...");
    let clearedCount = 0;
    for (const [namespace, serviceInstance] of CacheService.registry) {
      try {
        await serviceInstance.clearNamespace();
        logger.debug(MODULE_NAME, `Successfully cleared cache for namespace: "${namespace}".`);
        clearedCount++;
      } catch (error) {
        logger.error(MODULE_NAME, `Error clearing cache for namespace "${namespace}":`, error);
      }
    }
    logger.info(MODULE_NAME, `Finished clearing all registered caches. ${clearedCount} of ${CacheService.registry.size} namespaces cleared successfully.`);
  }

  private getFullKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private getFilePath(hashedKey: string): string | null {
    if (!this.persistentCachePath) {
      return null;
    }
    return path.join(this.persistentCachePath, hashedKey + '.json');
  }

  async get<T>(key: string): Promise<T | undefined> {
    const fullKey = this.getFullKey(key);
    const memItem = this.store.get(fullKey);

    if (memItem) {
      if (memItem.expiry && memItem.expiry < Date.now()) {
        logger.debug(MODULE_NAME, `[${this.namespace}] In-memory STALE for key: ${key}. Deleting.`);
        this.store.delete(fullKey);
        // Also attempt to delete from persistent store if it was stale in memory
        if (this.persistentCacheEnabled) {
          const hashedKey = this.hashKey(key);
          const filePath = this.getFilePath(hashedKey);
          if (filePath && await fileUtils.fileExists(filePath)) {
            try {
              await fileUtils.deleteFile(filePath);
              logger.debug(MODULE_NAME, `[${this.namespace}] Deleted STALE persistent cache for key: ${key} from ${filePath}`);
            } catch (e) {
              logger.warn(MODULE_NAME, `[${this.namespace}] Failed to delete STALE persistent cache for key ${key} from ${filePath}:`, e);
            }
          }
        }
        return undefined;
      }
      logger.debug(MODULE_NAME, `[${this.namespace}] In-memory HIT for key: ${key}`);
      return memItem.value as T;
    }
    logger.debug(MODULE_NAME, `[${this.namespace}] In-memory MISS for key: ${key}`);

    // Try persistent cache if enabled and not found in memory
    if (this.persistentCacheEnabled) {
      const hashedKey = this.hashKey(key);
      const filePath = this.getFilePath(hashedKey);
      if (filePath && await fileUtils.fileExists(filePath)) {
        try {
          logger.debug(MODULE_NAME, `[${this.namespace}] Attempting to read persistent cache for key: ${key} from ${filePath}`);
          const fileCacheItem = await fileUtils.readJsonFile<CacheItem<T>>(filePath);
          if (fileCacheItem) {
            if (fileCacheItem.expiry && fileCacheItem.expiry < Date.now()) {
              logger.debug(MODULE_NAME, `[${this.namespace}] Persistent STALE for key: ${key} at ${filePath}. Deleting.`);
              await fileUtils.deleteFile(filePath);
              return undefined;
            }
            logger.debug(MODULE_NAME, `[${this.namespace}] Persistent HIT for key: ${key} from ${filePath}. Hydrating memory.`);
            this.store.set(fullKey, fileCacheItem); // Hydrate in-memory cache
            return fileCacheItem.value as T;
          }
        } catch (error) {
          logger.warn(MODULE_NAME, `[${this.namespace}] Error reading or parsing persistent cache for key ${key} from ${filePath}:`, error);
          // Optionally delete corrupted file
          try { await fileUtils.deleteFile(filePath); } catch (e) { /* ignore delete error */ }
          return undefined;
        }
      } else {
        logger.debug(MODULE_NAME, `[${this.namespace}] Persistent MISS for key: ${key} (file not found).`);
      }
    }
    return undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const ttlToUse = ttlSeconds !== undefined ? ttlSeconds : this.defaultTtlSeconds;
    const cacheItem: CacheItem<T> = { value };

    if (ttlToUse && ttlToUse > 0) {
      cacheItem.expiry = Date.now() + ttlToUse * 1000;
      logger.debug(MODULE_NAME, `[${this.namespace}] SET in-memory key: ${key} with TTL: ${ttlToUse}s. Expires at: ${new Date(cacheItem.expiry).toISOString()}`);
    } else {
      logger.debug(MODULE_NAME, `[${this.namespace}] SET in-memory key: ${key} (no TTL / using instance default if 0 was passed explicitly for TTL)`);
    }
    this.store.set(fullKey, cacheItem);

    if (this.persistentCacheEnabled) {
      const hashedKey = this.hashKey(key);
      const filePath = this.getFilePath(hashedKey);
      if (filePath) {
        try {
          logger.debug(MODULE_NAME, `[${this.namespace}] Writing to persistent cache for key: ${key} at ${filePath}`);
          await fileUtils.writeJsonFile(filePath, cacheItem, 2);
        } catch (error) {
          logger.error(MODULE_NAME, `[${this.namespace}] Failed to write to persistent cache for key ${key} at ${filePath}:`, error);
        }
      }
    }
  }

  async has(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const memItem = this.store.get(fullKey);

    if (memItem) {
      if (memItem.expiry && memItem.expiry < Date.now()) {
        logger.debug(MODULE_NAME, `[${this.namespace}] HAS check: In-memory STALE for key: ${key}.`);
        // No need to delete here, get/set will handle it. Just report as not having.
        return false; 
      }
      logger.debug(MODULE_NAME, `[${this.namespace}] HAS check: In-memory HIT for key: ${key}`);
      return true;
    }

    if (this.persistentCacheEnabled) {
      const hashedKey = this.hashKey(key);
      const filePath = this.getFilePath(hashedKey);
      if (filePath && await fileUtils.fileExists(filePath)) {
        try {
          const fileCacheItem = await fileUtils.readJsonFile<CacheItem<any>>(filePath); // Read <any> just for expiry
          if (fileCacheItem && (!fileCacheItem.expiry || fileCacheItem.expiry >= Date.now())) {
            logger.debug(MODULE_NAME, `[${this.namespace}] HAS check: Persistent HIT for key: ${key}`);
            return true;
          }
          if (fileCacheItem && fileCacheItem.expiry && fileCacheItem.expiry < Date.now()){
             logger.debug(MODULE_NAME, `[${this.namespace}] HAS check: Persistent STALE for key: ${key}. Deleting.`);
             await fileUtils.deleteFile(filePath); // Proactively delete from disk
          }
        } catch (error) {
          logger.warn(MODULE_NAME, `[${this.namespace}] HAS check: Error reading persistent cache for key ${key}:`, error);
          return false; // Treat as not present if error occurs
        }
      }
    }
    logger.debug(MODULE_NAME, `[${this.namespace}] HAS check: MISS for key: ${key}`);
    return false;
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const memDeleted = this.store.delete(fullKey);
    if (memDeleted) {
      logger.debug(MODULE_NAME, `[${this.namespace}] DELETED in-memory key: ${key}`);
    }

    let persistentDeleted = false;
    if (this.persistentCacheEnabled) {
      const hashedKey = this.hashKey(key);
      const filePath = this.getFilePath(hashedKey);
      if (filePath && await fileUtils.fileExists(filePath)) {
        try {
          await fileUtils.deleteFile(filePath);
          persistentDeleted = true;
          logger.debug(MODULE_NAME, `[${this.namespace}] DELETED persistent cache for key: ${key} from ${filePath}`);
        } catch (error) {
          logger.error(MODULE_NAME, `[${this.namespace}] Failed to delete persistent cache for key ${key} from ${filePath}:`, error);
        }
      }
    }
    return memDeleted || persistentDeleted;
  }

  async clearNamespace(): Promise<void> {
    let memDeleteCount = 0;
    for (const currentFullKey of this.store.keys()) {
      if (currentFullKey.startsWith(`${this.namespace}:`)) {
        this.store.delete(currentFullKey);
        memDeleteCount++;
      }
    }
    logger.info(MODULE_NAME, `[${this.namespace}] CLEARED in-memory namespace. ${memDeleteCount} item(s) removed.`);

    if (this.persistentCacheEnabled && this.persistentCachePath) {
      try {
        logger.info(MODULE_NAME, `[${this.namespace}] Clearing persistent cache directory: ${this.persistentCachePath}`);
        await fileUtils.deleteDirectory(this.persistentCachePath); // Deletes the namespace folder
        await fileUtils.createDirectory(this.persistentCachePath); // Recreate for future use
        logger.info(MODULE_NAME, `[${this.namespace}] CLEARED persistent cache directory and recreated.`);
      } catch (error) {
        logger.error(MODULE_NAME, `[${this.namespace}] Failed to clear persistent cache directory ${this.persistentCachePath}:`, error);
      }
    }
  }
}

export default CacheService;
