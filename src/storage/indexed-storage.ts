import {
  AgentWorkload,
  Delegation,
  Feature,
  FeatureData,
  FeatureFilters,
  ParentTask,
  Subtask,
} from '~/features/types';

import { AgentRegistration, Message } from '~/types';

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
  private readonly agentCache = new Map<string, CacheEntry<AgentRegistration>>();

  // Indexes for fast filtering
  private readonly messagesByAgent: IndexMap<Message> = new Map();
  private readonly messagesByType: IndexMap<Message> = new Map();

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

    [this.messageCache, this.agentCache].forEach(cache => {
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
      this.agentCache.clear();

      this.messagesByAgent.clear();
      this.messagesByType.clear();

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
        agents: this.agentCache.size,
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
        // Deduplicate by message ID to handle duplicate object instances
        const messageMap = new Map<string, Message>();

        for (const message of agentMessages) {
          messageMap.set(message.id, message);
        }

        for (const message of broadcastMessages) {
          messageMap.set(message.id, message);
        }

        return [...messageMap.values()].sort((a, b) => a.timestamp - b.timestamp);
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

  async findAgentById(agentId: string): Promise<AgentRegistration | undefined> {
    // Check cache first
    const cached = this.agentCache.get(agentId);

    if (cached && this.isCacheEntryValid(cached)) {
      this.stats.hits++;

      return cached.data;
    }

    // Cache miss - delegate to file storage
    this.stats.misses++;
    const agent = await this.fileStorage.findAgentById(agentId);

    // Cache the result if found
    if (agent) {
      this.cacheAgent(agent);
    }

    return agent;
  }

  async findAgentByProjectPath(projectPath: string): Promise<AgentRegistration | undefined> {
    // First check cache - iterate through all cached agents
    for (const [, cached] of this.agentCache.entries()) {
      if (this.isCacheEntryValid(cached) && cached.data.projectPath === projectPath) {
        this.stats.hits++;

        return cached.data;
      }
    }

    // Cache miss - delegate to file storage
    this.stats.misses++;
    const agent = await this.fileStorage.findAgentByProjectPath(projectPath);

    // Cache the result if found
    if (agent) {
      this.cacheAgent(agent);
    }

    return agent;
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

  async cleanup(olderThanDays = 7): Promise<void> {
    await this.fileStorage.cleanup(olderThanDays);

    // Clear all caches and indexes since data has been deleted from storage
    this.messageCache.clear();
    this.agentCache.clear();

    // Clear all indexes
    this.messagesByAgent.clear();
    this.messagesByType.clear();

    // Re-warm caches with remaining data from storage
    await this.warmupCaches();
  }

  // Features system methods - delegate to FileStorage
  async createFeature(feature: Feature): Promise<void> {
    return this.fileStorage.createFeature(feature);
  }

  async getFeatures(filters?: FeatureFilters): Promise<Feature[]> {
    return this.fileStorage.getFeatures(filters);
  }

  async getFeature(featureId: string): Promise<Feature | undefined> {
    return this.fileStorage.getFeature(featureId);
  }

  async updateFeature(featureId: string, updates: Partial<Feature>): Promise<void> {
    return this.fileStorage.updateFeature(featureId, updates);
  }

  async createTask(featureId: string, task: ParentTask): Promise<void> {
    return this.fileStorage.createTask(featureId, task);
  }

  async getTasksInFeature(featureId: string): Promise<ParentTask[]> {
    return this.fileStorage.getTasksInFeature(featureId);
  }

  async getTask(featureId: string, taskId: string): Promise<ParentTask | undefined> {
    return this.fileStorage.getTask(featureId, taskId);
  }

  async updateTask(featureId: string, taskId: string, updates: Partial<ParentTask>): Promise<void> {
    return this.fileStorage.updateTask(featureId, taskId, updates);
  }

  async createDelegation(featureId: string, delegation: Delegation): Promise<void> {
    return this.fileStorage.createDelegation(featureId, delegation);
  }

  async getDelegations(featureId: string, agent?: string): Promise<Delegation[]> {
    return this.fileStorage.getDelegations(featureId, agent);
  }

  async getDelegation(featureId: string, delegationId: string): Promise<Delegation | undefined> {
    return this.fileStorage.getDelegation(featureId, delegationId);
  }

  async updateDelegation(
    featureId: string,
    delegationId: string,
    updates: Partial<Delegation>,
  ): Promise<void> {
    return this.fileStorage.updateDelegation(featureId, delegationId, updates);
  }

  async createSubtask(featureId: string, subtask: Subtask): Promise<void> {
    return this.fileStorage.createSubtask(featureId, subtask);
  }

  async getSubtasks(featureId: string, delegationId?: string): Promise<Subtask[]> {
    return this.fileStorage.getSubtasks(featureId, delegationId);
  }

  async getSubtask(featureId: string, subtaskId: string): Promise<Subtask | undefined> {
    return this.fileStorage.getSubtask(featureId, subtaskId);
  }

  async updateSubtask(
    featureId: string,
    subtaskId: string,
    updates: Partial<Subtask>,
  ): Promise<void> {
    return this.fileStorage.updateSubtask(featureId, subtaskId, updates);
  }

  async getAgentWorkload(agentId: string): Promise<AgentWorkload> {
    return this.fileStorage.getAgentWorkload(agentId);
  }

  async getFeatureData(featureId: string): Promise<FeatureData | undefined> {
    return this.fileStorage.getFeatureData(featureId);
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
