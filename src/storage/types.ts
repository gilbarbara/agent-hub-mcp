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
    messages: number;
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

  // Delegation operations within features
  createDelegation(featureId: string, delegation: Delegation): Promise<void>;
  // Features system methods
  createFeature(feature: Feature): Promise<void>;
  // Subtask operations within features
  createSubtask(featureId: string, subtask: Subtask): Promise<void>;
  // Task operations within features
  createTask(featureId: string, task: ParentTask): Promise<void>;

  findAgentById(agentId: string): Promise<AgentRegistration | undefined>;
  findAgentByProjectPath(projectPath: string): Promise<AgentRegistration | undefined>;
  getAgents(agentId?: string): Promise<AgentRegistration[]>;
  // Agent work discovery
  getAgentWorkload(agentId: string): Promise<AgentWorkload>;

  getDelegation(featureId: string, delegationId: string): Promise<Delegation | undefined>;
  getDelegations(featureId: string, agent?: string): Promise<Delegation[]>;
  getFeature(featureId: string): Promise<Feature | undefined>;

  // Complete feature data
  getFeatureData(featureId: string): Promise<FeatureData | undefined>;
  getFeatures(filters?: FeatureFilters): Promise<Feature[]>;

  getMessage(messageId: string): Promise<Message | undefined>;

  getMessages(filter?: {
    agent?: string;
    limit?: number;
    offset?: number;
    since?: number;
    type?: string;
  }): Promise<Message[]>;
  getSubtask(featureId: string, subtaskId: string): Promise<Subtask | undefined>;
  getSubtasks(featureId: string, delegationId?: string): Promise<Subtask[]>;
  getTask(featureId: string, taskId: string): Promise<ParentTask | undefined>;

  getTasksInFeature(featureId: string): Promise<ParentTask[]>;
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
   * Message storage operations
   */
  saveMessage(message: Message): Promise<void>;

  updateAgent(agentId: string, updates: Partial<AgentRegistration>): Promise<void>;
  updateDelegation(
    featureId: string,
    delegationId: string,
    updates: Partial<Delegation>,
  ): Promise<void>;
  updateFeature(featureId: string, updates: Partial<Feature>): Promise<void>;

  updateSubtask(featureId: string, subtaskId: string, updates: Partial<Subtask>): Promise<void>;

  updateTask(featureId: string, taskId: string, updates: Partial<ParentTask>): Promise<void>;
}
