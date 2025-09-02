import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {
  AgentFeatureWork,
  AgentWorkload,
  Delegation,
  Feature,
  FeatureData,
  FeatureFilters,
  FeatureStatus,
  ParentTask,
  PRIORITY_ORDER,
  Subtask,
} from '~/features/types';

import { AgentRegistration, Message } from '~/types';

import { StorageAdapter } from './types';

/**
 * File-based storage implementation for Agent Hub MCP.
 * Provides persistent storage using JSON files with security validation.
 */
export class FileStorage implements StorageAdapter {
  private readonly dataDirectory: string;

  constructor(dataDirectory = '.agent-hub') {
    // Expand ~ to home directory
    if (dataDirectory.startsWith('~/')) {
      // eslint-disable-next-line no-param-reassign
      dataDirectory = path.join(os.homedir(), dataDirectory.slice(2));
    }

    this.dataDirectory = path.resolve(dataDirectory);
  }

  async init(): Promise<void> {
    const directories = ['messages', 'agents', 'features'];

    for (const directory of directories) {
      await fs.mkdir(path.join(this.dataDirectory, directory), { recursive: true });
    }
  }

  /**
   * Validates and sanitizes file path components to prevent directory traversal
   */
  private validatePathComponent(component: string, maxLength = 255): string {
    if (!component || typeof component !== 'string') {
      throw new Error('Invalid path component: must be a non-empty string');
    }

    // Remove any path traversal sequences and directory separators
    const sanitized = component.replace(/\.\./g, '').replace(/[/\\]/g, '').replace(/\0/g, ''); // Remove null bytes

    // Only allow alphanumeric, dash, underscore, dot (for extensions), and colon (for namespacing)
    if (!/^[\w.:-]+$/.test(sanitized)) {
      throw new Error(`Invalid characters in path component: ${component}`);
    }

    if (sanitized.length > maxLength) {
      throw new Error(`Path component too long: ${sanitized.length} > ${maxLength}`);
    }

    return sanitized;
  }

  /**
   * Ensures a file path is within the allowed data directory
   */
  private validateFullPath(filePath: string): string {
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(this.dataDirectory)) {
      throw new Error('Path traversal attempt detected');
    }

    return resolved;
  }

  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const validPath = this.validateFullPath(filePath);
      const content = await fs.readFile(validPath, 'utf-8');

      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    const validPath = this.validateFullPath(filePath);

    // Sanitize the data to prevent prototype pollution
    const sanitizedData = JSON.parse(JSON.stringify(data));

    await fs.writeFile(validPath, JSON.stringify(sanitizedData, null, 2));
  }

  async saveMessage(message: Message): Promise<void> {
    const safeId = this.validatePathComponent(message.id);
    const filePath = path.join(this.dataDirectory, 'messages', `${safeId}.json`);

    await this.writeJsonFile(filePath, message);
  }

  async getMessages(filter?: {
    agent?: string;
    limit?: number;
    offset?: number;
    since?: number;
    type?: string;
  }): Promise<Message[]> {
    const messagesDirectory = path.join(this.dataDirectory, 'messages');
    const files = await fs.readdir(messagesDirectory);
    const messages: Message[] = [];

    // Try to sort files by modification time for better performance with recent messages
    // If stat fails (e.g., in tests), fall back to filename order
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    let sortedFiles = jsonFiles;

    try {
      const fileStats = await Promise.all(
        jsonFiles.map(async file => {
          try {
            const stats = await fs.stat(path.join(messagesDirectory, file));

            return { file, stats };
          } catch {
            return { file, stats: null };
          }
        }),
      );

      const validStats = fileStats.filter(item => item.stats);

      if (validStats.length > 0) {
        sortedFiles = validStats
          .toSorted((a, b) => b.stats!.mtime.getTime() - a.stats!.mtime.getTime())
          .map(item => item.file);
      }
    } catch {
      // Fall back to original order if stat operations fail
      sortedFiles = jsonFiles;
    }

    let matchingCount = 0;
    const limit = filter?.limit;
    const offset = filter?.offset || 0;

    for (const file of sortedFiles) {
      const message = await this.readJsonFile<Message>(path.join(messagesDirectory, file));

      if (message) {
        // Apply filters first
        let passesFilters = true;

        if (filter) {
          if (filter.agent && message.to !== filter.agent && message.to !== 'all') {
            passesFilters = false;
          }

          if (filter.type && message.type !== filter.type) {
            passesFilters = false;
          }

          if (filter.since && message.timestamp < filter.since) {
            passesFilters = false;
          }
        }

        // If message passes filters, handle pagination
        if (passesFilters) {
          // Skip messages before offset
          if (matchingCount < offset) {
            matchingCount++;
            continue;
          }

          messages.push(message);
          matchingCount++;

          // Stop if we've reached the limit
          if (limit && messages.length >= limit) {
            break;
          }
        }
      }
    }

    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const safeId = this.validatePathComponent(messageId);
    const filePath = path.join(this.dataDirectory, 'messages', `${safeId}.json`);
    const message = await this.readJsonFile<Message>(filePath);

    return message ?? undefined;
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    const safeId = this.validatePathComponent(messageId);
    const filePath = path.join(this.dataDirectory, 'messages', `${safeId}.json`);

    try {
      const message = await this.readJsonFile<Message>(filePath);

      if (message && !message.read) {
        // Only update if message exists and is not already read (idempotent)
        message.read = true;
        await this.writeJsonFile(filePath, message);
      }
    } catch (error) {
      // Re-throw with more context for debugging
      throw new Error(
        `Failed to mark message ${messageId} as read: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async saveAgent(agent: AgentRegistration): Promise<void> {
    const safeId = this.validatePathComponent(agent.id);
    const filePath = path.join(this.dataDirectory, 'agents', `${safeId}.json`);

    await this.writeJsonFile(filePath, agent);
  }

  async saveAllAgents(agents: AgentRegistration[]): Promise<void> {
    const agentsDirectory = path.join(this.dataDirectory, 'agents');

    // Clear existing agent files
    const files = await fs.readdir(agentsDirectory);

    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(this.validateFullPath(path.join(agentsDirectory, file)));
      }
    }

    // Save new agent list
    for (const agent of agents) {
      await this.saveAgent(agent);
    }
  }

  async getAgents(agentId?: string): Promise<AgentRegistration[]> {
    const agentsDirectory = path.join(this.dataDirectory, 'agents');
    const files = await fs.readdir(agentsDirectory);
    const agents: AgentRegistration[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const agent = await this.readJsonFile<AgentRegistration>(path.join(agentsDirectory, file));

        if (agent) {
          if (agentId && agent.id !== agentId) {
            continue;
          }

          agents.push(agent);
        }
      }
    }

    return agents;
  }

  async findAgentById(agentId: string): Promise<AgentRegistration | undefined> {
    const safeId = this.validatePathComponent(agentId);
    const filePath = path.join(this.dataDirectory, 'agents', `${safeId}.json`);

    return (await this.readJsonFile<AgentRegistration>(filePath)) || undefined;
  }

  async findAgentByProjectPath(projectPath: string): Promise<AgentRegistration | undefined> {
    const agentsDirectory = path.join(this.dataDirectory, 'agents');
    const files = await fs.readdir(agentsDirectory);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const agent = await this.readJsonFile<AgentRegistration>(path.join(agentsDirectory, file));

        if (agent && agent.projectPath === projectPath) {
          return agent;
        }
      }
    }

    return undefined;
  }

  async updateAgent(agentId: string, updates: Partial<AgentRegistration>): Promise<void> {
    const safeId = this.validatePathComponent(agentId);
    const filePath = path.join(this.dataDirectory, 'agents', `${safeId}.json`);
    const agent = await this.readJsonFile<AgentRegistration>(filePath);

    if (agent) {
      const updatedAgent = { ...agent, ...updates };

      await this.writeJsonFile(filePath, updatedAgent);
    }
  }

  async cleanup(olderThanDays = 7): Promise<void> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const messagesDirectory = path.join(this.dataDirectory, 'messages');
    const files = await fs.readdir(messagesDirectory);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const message = await this.readJsonFile<Message>(path.join(messagesDirectory, file));

        if (message && message.timestamp < cutoffTime) {
          await fs.unlink(this.validateFullPath(path.join(messagesDirectory, file)));
        }
      }
    }
  }

  // Features system implementation

  async createFeature(feature: Feature): Promise<void> {
    const safeId = this.validatePathComponent(feature.id);
    const featureDirectory = path.join(this.dataDirectory, 'features', safeId);

    // Create feature directory structure
    await fs.mkdir(featureDirectory, { recursive: true });
    await fs.mkdir(path.join(featureDirectory, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(featureDirectory, 'delegations'), { recursive: true });
    await fs.mkdir(path.join(featureDirectory, 'subtasks'), { recursive: true });

    const featureFile = path.join(featureDirectory, 'feature.json');

    await this.writeJsonFile(featureFile, feature);
  }

  async getFeatures(filters?: FeatureFilters): Promise<Feature[]> {
    const featuresDirectory = path.join(this.dataDirectory, 'features');

    try {
      const featureIds = await fs.readdir(featuresDirectory);
      const features: Feature[] = [];

      for (const featureId of featureIds) {
        const featureFile = path.join(featuresDirectory, featureId, 'feature.json');
        const feature = await this.readJsonFile<Feature>(featureFile);

        if (feature) {
          // Apply filters
          if (filters?.status && feature.status !== filters.status) {
            continue;
          }

          if (filters?.priority && feature.priority !== filters.priority) {
            continue;
          }

          if (filters?.createdBy && feature.createdBy !== filters.createdBy) {
            continue;
          }

          if (filters?.agent && !feature.assignedAgents?.includes(filters.agent)) {
            continue;
          }

          features.push(feature);
        }
      }

      // Sort by priority and then by creation time
      return features.sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return b.createdAt - a.createdAt;
      });
    } catch {
      return [];
    }
  }

  async getFeature(featureId: string): Promise<Feature | undefined> {
    const safeId = this.validatePathComponent(featureId);
    const featureFile = path.join(this.dataDirectory, 'features', safeId, 'feature.json');

    const result = await this.readJsonFile<Feature>(featureFile);

    return result || undefined;
  }

  async updateFeature(featureId: string, updates: Partial<Feature>): Promise<void> {
    const feature = await this.getFeature(featureId);

    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`);
    }

    const updatedFeature = { ...feature, ...updates, updatedAt: Date.now() };
    const safeId = this.validatePathComponent(featureId);
    const featureFile = path.join(this.dataDirectory, 'features', safeId, 'feature.json');

    await this.writeJsonFile(featureFile, updatedFeature);
  }

  async createTask(featureId: string, task: ParentTask): Promise<void> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeTaskId = this.validatePathComponent(task.id);
    const taskFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'tasks',
      `${safeTaskId}.json`,
    );

    await this.writeJsonFile(taskFile, task);
  }

  async getTasksInFeature(featureId: string): Promise<ParentTask[]> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const tasksDirectory = path.join(this.dataDirectory, 'features', safeFeatureId, 'tasks');

    try {
      const files = await fs.readdir(tasksDirectory);
      const tasks: ParentTask[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const task = await this.readJsonFile<ParentTask>(path.join(tasksDirectory, file));

          if (task) {
            tasks.push(task);
          }
        }
      }

      return tasks.sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      return [];
    }
  }

  async getTask(featureId: string, taskId: string): Promise<ParentTask | undefined> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeTaskId = this.validatePathComponent(taskId);
    const taskFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'tasks',
      `${safeTaskId}.json`,
    );

    const result = await this.readJsonFile<ParentTask>(taskFile);

    return result || undefined;
  }

  async updateTask(featureId: string, taskId: string, updates: Partial<ParentTask>): Promise<void> {
    const task = await this.getTask(featureId, taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId} in feature ${featureId}`);
    }

    const updatedTask = { ...task, ...updates, updatedAt: Date.now() };
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeTaskId = this.validatePathComponent(taskId);
    const taskFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'tasks',
      `${safeTaskId}.json`,
    );

    await this.writeJsonFile(taskFile, updatedTask);
  }

  async createDelegation(featureId: string, delegation: Delegation): Promise<void> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeDelegationId = this.validatePathComponent(delegation.id);
    const delegationFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'delegations',
      `${safeDelegationId}.json`,
    );

    await this.writeJsonFile(delegationFile, delegation);
  }

  async getDelegations(featureId: string, agent?: string): Promise<Delegation[]> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const delegationsDirectory = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'delegations',
    );

    try {
      const files = await fs.readdir(delegationsDirectory);
      const delegations: Delegation[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const delegation = await this.readJsonFile<Delegation>(
            path.join(delegationsDirectory, file),
          );

          if (delegation) {
            if (agent && delegation.agent !== agent) {
              continue;
            }

            delegations.push(delegation);
          }
        }
      }

      return delegations.sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      return [];
    }
  }

  async getDelegation(featureId: string, delegationId: string): Promise<Delegation | undefined> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeDelegationId = this.validatePathComponent(delegationId);
    const delegationFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'delegations',
      `${safeDelegationId}.json`,
    );

    const result = await this.readJsonFile<Delegation>(delegationFile);

    return result || undefined;
  }

  async updateDelegation(
    featureId: string,
    delegationId: string,
    updates: Partial<Delegation>,
  ): Promise<void> {
    const delegation = await this.getDelegation(featureId, delegationId);

    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId} in feature ${featureId}`);
    }

    const updatedDelegation = { ...delegation, ...updates, updatedAt: Date.now() };
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeDelegationId = this.validatePathComponent(delegationId);
    const delegationFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'delegations',
      `${safeDelegationId}.json`,
    );

    await this.writeJsonFile(delegationFile, updatedDelegation);
  }

  async createSubtask(featureId: string, subtask: Subtask): Promise<void> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeSubtaskId = this.validatePathComponent(subtask.id);
    const subtaskFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'subtasks',
      `${safeSubtaskId}.json`,
    );

    await this.writeJsonFile(subtaskFile, subtask);
  }

  async getSubtasks(featureId: string, delegationId?: string): Promise<Subtask[]> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const subtasksDirectory = path.join(this.dataDirectory, 'features', safeFeatureId, 'subtasks');

    try {
      const files = await fs.readdir(subtasksDirectory);
      const subtasks: Subtask[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const subtask = await this.readJsonFile<Subtask>(path.join(subtasksDirectory, file));

          if (subtask) {
            if (delegationId && subtask.delegationId !== delegationId) {
              continue;
            }

            subtasks.push(subtask);
          }
        }
      }

      return subtasks.sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      return [];
    }
  }

  async getSubtask(featureId: string, subtaskId: string): Promise<Subtask | undefined> {
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeSubtaskId = this.validatePathComponent(subtaskId);
    const subtaskFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'subtasks',
      `${safeSubtaskId}.json`,
    );

    const result = await this.readJsonFile<Subtask>(subtaskFile);

    return result || undefined;
  }

  async updateSubtask(
    featureId: string,
    subtaskId: string,
    updates: Partial<Subtask>,
  ): Promise<void> {
    const subtask = await this.getSubtask(featureId, subtaskId);

    if (!subtask) {
      throw new Error(`Subtask not found: ${subtaskId} in feature ${featureId}`);
    }

    const updatedSubtask = { ...subtask, ...updates, updatedAt: Date.now() };
    const safeFeatureId = this.validatePathComponent(featureId);
    const safeSubtaskId = this.validatePathComponent(subtaskId);
    const subtaskFile = path.join(
      this.dataDirectory,
      'features',
      safeFeatureId,
      'subtasks',
      `${safeSubtaskId}.json`,
    );

    await this.writeJsonFile(subtaskFile, updatedSubtask);
  }

  async getAgentWorkload(agentId: string): Promise<AgentWorkload> {
    const featuresDirectory = path.join(this.dataDirectory, 'features');
    const activeFeatures: AgentFeatureWork[] = [];

    try {
      const featureIds = await fs.readdir(featuresDirectory);

      for (const featureId of featureIds) {
        const feature = await this.getFeature(featureId);

        if (!feature || feature.status !== FeatureStatus.ACTIVE) {
          continue;
        }

        const myDelegations = await this.getDelegations(featureId, agentId);

        if (myDelegations.length === 0) {
          continue;
        }

        const mySubtasks = await this.getSubtasks(featureId).then(subtasks =>
          subtasks.filter(s => s.createdBy === agentId),
        );

        activeFeatures.push({
          featureId,
          feature,
          myDelegations,
          mySubtasks,
        });
      }

      // Sort by feature priority
      activeFeatures.sort((a, b) => {
        const aPriority = PRIORITY_ORDER[a.feature.priority];
        const bPriority = PRIORITY_ORDER[b.feature.priority];

        return aPriority - bPriority;
      });

      return { activeFeatures };
    } catch {
      return { activeFeatures: [] };
    }
  }

  async getFeatureData(featureId: string): Promise<FeatureData | undefined> {
    const feature = await this.getFeature(featureId);

    if (!feature) {
      return undefined;
    }

    const [tasks, delegations, subtasks] = await Promise.all([
      this.getTasksInFeature(featureId),
      this.getDelegations(featureId),
      this.getSubtasks(featureId),
    ]);

    return {
      feature,
      tasks,
      delegations,
      subtasks,
    };
  }
}
