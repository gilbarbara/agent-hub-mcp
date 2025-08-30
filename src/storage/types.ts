import { AgentRegistration, Message, SharedContext, TaskStatus } from '~/types';

/**
 * Extended storage adapter with performance monitoring
 */
export interface CacheableStorageAdapter extends StorageAdapter {
  getCacheStats(): CacheStats;
}

/**
 * Cache performance metrics
 */
export interface CacheStats {
  cacheSize: {
    agents: number;
    contexts: number;
    messages: number;
    tasks: number;
  };
  hitRate: number;
  hits: number;
  indexHits: number;
  misses: number;
  writes: number;
}

/**
 * Index configuration for optimized queries
 */
export interface IndexConfig {
  /**
   * TTL for cache entries in milliseconds
   */
  cacheTtl?: number;

  /**
   * Fields to index for fast lookups
   */
  indexFields: string[];

  /**
   * Maximum cache size (number of entries)
   */
  maxCacheSize?: number;
}

/**
 * Query result with metadata for optimized operations
 */
export interface QueryResult<T> {
  count: number;
  data: T[];
  fromCache?: boolean;
  queryTime?: number;
}

/**
 * Storage interface for Agent Hub MCP data persistence.
 * Provides abstraction layer for different storage implementations.
 */
export interface StorageAdapter {
  /**
   * Cleanup operations
   */
  cleanup(olderThanDays?: number): Promise<void>;

  getAgents(agentId?: string): Promise<AgentRegistration[]>;
  getContext(key?: string, namespace?: string): Promise<Record<string, SharedContext>>;
  getMessage(messageId: string): Promise<Message | undefined>;
  getMessages(filter?: {
    agent?: string;
    limit?: number;
    offset?: number;
    since?: number;
    type?: string;
  }): Promise<Message[]>;

  getTasks(agent?: string): Promise<TaskStatus[]>;
  /**
   * Initialize the storage system (create directories, indices, etc.)
   */
  init(): Promise<void>;

  markMessageAsRead(messageId: string): Promise<void>;
  /**
   * Agent registration operations
   */
  saveAgent(agent: AgentRegistration): Promise<void>;
  saveAllAgents(agents: AgentRegistration[]): Promise<void>;
  /**
   * Context storage operations
   */
  saveContext(context: SharedContext): Promise<void>;

  /**
   * Message storage operations
   */
  saveMessage(message: Message): Promise<void>;
  /**
   * Task coordination operations
   */
  saveTask(task: TaskStatus): Promise<void>;

  updateAgent(agentId: string, updates: Partial<AgentRegistration>): Promise<void>;
}
