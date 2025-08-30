import { AgentRegistration, Message, SharedContext, TaskStatus } from '~/types';

import { FileStorage } from './file-storage';
import { CacheableStorageAdapter, CacheStats, IndexConfig } from './types';

/**
 * Type alias for in-memory index maps
 */
type IndexMap<T> = Map<string, Set<T>>;

/**
 * Cache entry with TTL support
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

/**
 * High-performance storage adapter with in-memory indexing and caching.
 * Provides significant performance improvements for frequent queries while
 * maintaining all persistence guarantees of the underlying FileStorage.
 */
export class IndexedStorage implements CacheableStorageAdapter {
  private readonly fileStorage: FileStorage;
  private readonly config: IndexConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  // In-memory caches
  private readonly messageCache = new Map<string, CacheEntry<Message>>();
  private readonly contextCache = new Map<string, CacheEntry<SharedContext>>();
  private readonly agentCache = new Map<string, CacheEntry<AgentRegistration>>();
  private readonly taskCache = new Map<string, CacheEntry<TaskStatus>>();

  // Indexes for fast filtering
  private readonly messagesByAgent: IndexMap<Message> = new Map();
  private readonly messagesByType: IndexMap<Message> = new Map();
  private readonly contextsByNamespace: IndexMap<SharedContext> = new Map();
  private readonly tasksByAgent: IndexMap<TaskStatus> = new Map();

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    indexHits: 0,
    writes: 0,
  };

  constructor(dataDirectory = '.agent-hub', config: Partial<IndexConfig> = {}) {
    this.fileStorage = new FileStorage(dataDirectory);
    this.config = {
      indexFields: ['agent', 'type', 'namespace'],
      cacheTtl: 5 * 60 * 1000, // 5 minutes default
      maxCacheSize: 10000,
      ...config,
    };

    // Periodic cleanup of expired cache entries
    this.cleanupTimer = setInterval(() => this.cleanupExpiredCache(), 60000); // Every minute
  }

  async init(): Promise<void> {
    await this.fileStorage.init();
    await this.warmupCaches();
  }

  /**
   * Pre-load frequently accessed data into caches
   */
  private async warmupCaches(): Promise<void> {
    try {
      // Load recent messages for fast access
      const recentMessages = await this.fileStorage.getMessages({
        since: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      });

      for (const message of recentMessages) {
        this.cacheMessage(message);
      }

      // Load all agents (typically small dataset)
      const agents = await this.fileStorage.getAgents();

      for (const agent of agents) {
        this.cacheAgent(agent);
      }

      // Load recent contexts (last 7 days)
      const contexts = await this.fileStorage.getContext();
      const recentTime = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const context of Object.values(contexts)) {
        if (context.timestamp > recentTime) {
          this.cacheContext(context);
        }
      }

      // Load recent tasks (last 7 days)
      const tasks = await this.fileStorage.getTasks();

      for (const task of tasks) {
        if (task.timestamp > recentTime) {
          this.cacheTask(task);
        }
      }
    } catch (error) {
      // If warmup fails, continue without cache - it will populate on demand

      // eslint-disable-next-line no-console
      console.warn('Cache warmup failed:', error);
    }
  }

  /**
   * Cache a message with indexing
   */
  private cacheMessage(message: Message): void {
    this.messageCache.set(message.id, {
      data: message,
      timestamp: Date.now(),
      ttl: this.config.cacheTtl,
    });

    // Update indexes - index messages by their actual recipient
    this.addToIndex(this.messagesByAgent, message.to, message);
    this.addToIndex(this.messagesByType, message.type, message);

    this.enforceMaxCacheSize(this.messageCache);
  }

  /**
   * Cache a context entry with indexing
   */
  private cacheContext(context: SharedContext): void {
    this.contextCache.set(context.key, {
      data: context,
      timestamp: Date.now(),
      ttl: context.ttl ?? this.config.cacheTtl,
    });

    // Update namespace index
    if (context.namespace) {
      this.addToIndex(this.contextsByNamespace, context.namespace, context);
    }

    this.enforceMaxCacheSize(this.contextCache);
  }

  /**
   * Cache an agent with indexing
   */
  private cacheAgent(agent: AgentRegistration): void {
    this.agentCache.set(agent.id, {
      data: agent,
      timestamp: Date.now(),
      ttl: this.config.cacheTtl,
    });

    this.enforceMaxCacheSize(this.agentCache);
  }

  /**
   * Cache a task with indexing
   */
  private cacheTask(task: TaskStatus): void {
    this.taskCache.set(task.id, {
      data: task,
      timestamp: Date.now(),
      ttl: this.config.cacheTtl,
    });

    // Update agent index
    this.addToIndex(this.tasksByAgent, task.agent, task);

    this.enforceMaxCacheSize(this.taskCache);
  }

  /**
   * Add item to index
   */
  private addToIndex<T>(index: IndexMap<T>, key: string, item: T): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }

    index.get(key)!.add(item);
  }

  /**
   * Remove item from index
   */
  private removeFromIndex<T>(index: IndexMap<T>, key: string, item: T): void {
    const set = index.get(key);

    if (set) {
      set.delete(item);

      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Enforce maximum cache size using efficient LRU eviction
   */
  private enforceMaxCacheSize<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size > this.config.maxCacheSize!) {
      // Calculate how many entries to remove (10%)
      const toRemove = Math.floor(cache.size * 0.1);
      const entriesToRemove: string[] = [];

      // Use quickselect-like approach to find oldest entries without full sort

      // First pass: find the Nth oldest timestamp
      const timestamps: number[] = [];

      for (const [, entry] of cache.entries()) {
        timestamps.push(entry.timestamp);
      }

      // Partial sort to find the threshold - only sort what we need
      timestamps.sort((a, b) => a - b);
      const thresholdTime = timestamps[toRemove - 1];

      // Second pass: collect entries to remove
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp <= thresholdTime && entriesToRemove.length < toRemove) {
          entriesToRemove.push(key);
        }
      }

      // Remove the selected entries
      for (const key of entriesToRemove) {
        cache.delete(key);
      }
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();

    [this.messageCache, this.contextCache, this.agentCache, this.taskCache].forEach(cache => {
      for (const [key, entry] of cache.entries()) {
        if (entry.ttl && now - entry.timestamp > entry.ttl) {
          cache.delete(key);
        }
      }
    });
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheEntryValid<T>(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) {
      return true;
    }

    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Check if context is still valid based on its TTL
   */
  private isContextValid(context: SharedContext): boolean {
    if (!context.ttl) {
      return true;
    }

    return Date.now() - context.timestamp < context.ttl;
  }

  /**
   * Invalidate a message from cache and indexes (reserved for future use)
   */
  // @ts-expect-error - Method reserved for future cache invalidation features
  private invalidateMessage(message: Message): void {
    // Remove from cache
    this.messageCache.delete(message.id);

    // Remove from indexes
    this.removeFromIndex(this.messagesByAgent, message.to, message);
    this.removeFromIndex(this.messagesByType, message.type, message);
  }

  /**
   * Invalidate a context from cache and indexes (reserved for future use)
   */
  // @ts-expect-error - Method reserved for future cache invalidation features
  private invalidateContext(context: SharedContext): void {
    // Remove from cache
    this.contextCache.delete(context.key);

    // Remove from namespace index
    if (context.namespace) {
      this.removeFromIndex(this.contextsByNamespace, context.namespace, context);
    }
  }

  /**
   * Invalidate a task from cache and indexes (reserved for future use)
   */
  // @ts-expect-error - Method reserved for future cache invalidation features
  private invalidateTask(task: TaskStatus): void {
    // Remove from cache
    this.taskCache.delete(task.id);

    // Remove from agent index
    this.removeFromIndex(this.tasksByAgent, task.agent, task);
  }

  /**
   * Validate cache integrity and detect corruption (reserved for future use)
   */
  // @ts-expect-error - Method reserved for future cache validation features
  private async validateCacheIntegrity(): Promise<boolean> {
    try {
      // Check if cache entries have valid structure
      for (const [key, entry] of this.messageCache.entries()) {
        if (!entry.data || !entry.timestamp || !entry.data.id) {
          // eslint-disable-next-line no-console
          console.warn(`Corrupted message cache entry: ${key}`);

          return false;
        }
      }

      for (const [key, entry] of this.contextCache.entries()) {
        if (!entry.data || !entry.timestamp || !entry.data.key) {
          // eslint-disable-next-line no-console
          console.warn(`Corrupted context cache entry: ${key}`);

          return false;
        }
      }

      // Validate index consistency
      for (const [agentKey, messageSet] of this.messagesByAgent.entries()) {
        for (const message of messageSet) {
          if (message.to !== agentKey) {
            // eslint-disable-next-line no-console
            console.warn(
              `Index inconsistency: message ${message.id} indexed under wrong agent ${agentKey}`,
            );

            return false;
          }
        }
      }

      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Cache integrity validation failed:', error);

      return false;
    }
  }

  /**
   * Recover from cache corruption by rebuilding from storage
   */
  private async recoverFromCorruption(): Promise<void> {
    // eslint-disable-next-line no-console
    console.warn('Recovering from cache corruption...');

    try {
      // Clear all corrupted cache and index data
      this.messageCache.clear();
      this.contextCache.clear();
      this.agentCache.clear();
      this.taskCache.clear();

      this.messagesByAgent.clear();
      this.messagesByType.clear();
      this.contextsByNamespace.clear();
      this.tasksByAgent.clear();

      // Rebuild from storage
      await this.warmupCaches();

      // eslint-disable-next-line no-console
      console.log('Cache recovery completed successfully');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Cache recovery failed:', error);
      throw new Error('Unable to recover from cache corruption');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      ...this.stats,
      cacheSize: {
        messages: this.messageCache.size,
        contexts: this.contextCache.size,
        agents: this.agentCache.size,
        tasks: this.taskCache.size,
      },
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
    };
  }

  // StorageAdapter implementation
  async saveMessage(message: Message): Promise<void> {
    await this.fileStorage.saveMessage(message);

    try {
      this.cacheMessage(message);
    } catch (error) {
      // If caching fails, recover and retry
      // eslint-disable-next-line no-console
      console.warn('Cache operation failed, attempting recovery:', error);
      await this.recoverFromCorruption();
      this.cacheMessage(message);
    }

    this.stats.writes++;
  }

  async getMessages(filter?: {
    agent?: string;
    limit?: number;
    offset?: number;
    since?: number;
    type?: string;
  }): Promise<Message[]> {
    // Try to use indexes for common queries (without pagination complexity)
    if (filter?.agent && !filter.since && !filter.type && !filter.limit && !filter.offset) {
      const agentMessages = this.messagesByAgent.get(filter.agent) ?? new Set();
      const broadcastMessages = this.messagesByAgent.get('all') ?? new Set();

      if (agentMessages.size > 0 || broadcastMessages.size > 0) {
        this.stats.indexHits++;

        // Combine messages for the specific agent and broadcast messages
        const allMessages = new Set([...agentMessages, ...broadcastMessages]);

        return [...allMessages].sort((a, b) => a.timestamp - b.timestamp);
      }
    }

    // Fall back to file storage
    this.stats.misses++;
    const messages = await this.fileStorage.getMessages(filter);

    // Cache the results
    for (const message of messages) {
      this.cacheMessage(message);
    }

    return messages;
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const cached = this.messageCache.get(messageId);

    if (cached && this.isCacheEntryValid(cached)) {
      this.stats.hits++;

      return cached.data;
    }

    this.stats.misses++;
    const message = await this.fileStorage.getMessage(messageId);

    if (message) {
      this.cacheMessage(message);
    }

    return message;
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await this.fileStorage.markMessageAsRead(messageId);

    // Update cache if present
    const cached = this.messageCache.get(messageId);

    if (cached) {
      cached.data.read = true;
    }

    this.stats.writes++;
  }

  async saveContext(context: SharedContext): Promise<void> {
    await this.fileStorage.saveContext(context);
    this.cacheContext(context);
    this.stats.writes++;
  }

  async getContext(key?: string, namespace?: string): Promise<Record<string, SharedContext>> {
    // Try namespace index for filtered queries
    if (!key && namespace) {
      const cachedContexts = this.contextsByNamespace.get(namespace);

      if (cachedContexts) {
        this.stats.indexHits++;
        const result: Record<string, SharedContext> = {};

        for (const context of cachedContexts) {
          // Check TTL using helper method
          if (this.isContextValid(context)) {
            result[context.key] = context;
          }
        }

        return result;
      }
    }

    // Single key lookup
    if (key && !namespace) {
      const cached = this.contextCache.get(key);

      if (cached && this.isCacheEntryValid(cached)) {
        this.stats.hits++;

        // Check context TTL using helper method
        const context = cached.data;

        if (this.isContextValid(context)) {
          return { [key]: context };
        }

        this.contextCache.delete(key);

        return {};
      }
    }

    // Fall back to file storage
    this.stats.misses++;
    const contexts = await this.fileStorage.getContext(key, namespace);

    // Cache the results
    for (const context of Object.values(contexts)) {
      this.cacheContext(context);
    }

    return contexts;
  }

  async saveAgent(agent: AgentRegistration): Promise<void> {
    await this.fileStorage.saveAgent(agent);
    this.cacheAgent(agent);
    this.stats.writes++;
  }

  async saveAllAgents(agents: AgentRegistration[]): Promise<void> {
    await this.fileStorage.saveAllAgents(agents);

    // Atomic cache update: build new cache first, then replace
    const newAgentCache = new Map<string, CacheEntry<AgentRegistration>>();

    for (const agent of agents) {
      newAgentCache.set(agent.id, {
        data: agent,
        timestamp: Date.now(),
        ttl: this.config.cacheTtl,
      });
    }

    // Replace the old cache atomically
    this.agentCache.clear();

    for (const [key, entry] of newAgentCache.entries()) {
      this.agentCache.set(key, entry);
    }

    this.stats.writes++;
  }

  async getAgents(agentId?: string): Promise<AgentRegistration[]> {
    if (agentId) {
      const cached = this.agentCache.get(agentId);

      if (cached && this.isCacheEntryValid(cached)) {
        this.stats.hits++;

        return [cached.data];
      }
    } else if (this.agentCache.size > 0) {
      // Return all cached agents if cache is populated
      const allCached = [...this.agentCache.values()]
        .filter(entry => this.isCacheEntryValid(entry))
        .map(entry => entry.data);

      if (allCached.length > 0) {
        this.stats.hits++;

        return allCached;
      }
    }

    this.stats.misses++;
    const agents = await this.fileStorage.getAgents(agentId);

    // Cache the results
    for (const agent of agents) {
      this.cacheAgent(agent);
    }

    return agents;
  }

  async updateAgent(agentId: string, updates: Partial<AgentRegistration>): Promise<void> {
    await this.fileStorage.updateAgent(agentId, updates);

    // Update cache if present
    const cached = this.agentCache.get(agentId);

    if (cached) {
      Object.assign(cached.data, updates);
    }

    this.stats.writes++;
  }

  async saveTask(task: TaskStatus): Promise<void> {
    await this.fileStorage.saveTask(task);
    this.cacheTask(task);
    this.stats.writes++;
  }

  async getTasks(agent?: string): Promise<TaskStatus[]> {
    // Try agent index
    if (agent) {
      const cachedTasks = this.tasksByAgent.get(agent);

      if (cachedTasks) {
        this.stats.indexHits++;

        return [...cachedTasks];
      }
    }

    this.stats.misses++;
    const tasks = await this.fileStorage.getTasks(agent);

    // Cache the results
    for (const task of tasks) {
      this.cacheTask(task);
    }

    return tasks;
  }

  async cleanup(olderThanDays = 7): Promise<void> {
    await this.fileStorage.cleanup(olderThanDays);

    // Clear all caches and indexes since data has been deleted from storage
    this.messageCache.clear();
    this.contextCache.clear();
    this.agentCache.clear();
    this.taskCache.clear();

    // Clear all indexes
    this.messagesByAgent.clear();
    this.messagesByType.clear();
    this.contextsByNamespace.clear();
    this.tasksByAgent.clear();

    // Re-warm caches with remaining data from storage
    await this.warmupCaches();
  }

  /**
   * Dispose of resources and stop background timers
   * Call this when the IndexedStorage instance is no longer needed
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
