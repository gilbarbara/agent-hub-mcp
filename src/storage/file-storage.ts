import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { AgentRegistration, Message, SharedContext, TaskStatus } from '~/types';

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
    const directories = ['messages', 'context', 'agents', 'tasks'];

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

  async saveContext(context: SharedContext): Promise<void> {
    const safeKey = this.validatePathComponent(context.key);
    const filePath = path.join(this.dataDirectory, 'context', `${safeKey}.json`);

    await this.writeJsonFile(filePath, context);
  }

  async getContext(key?: string, namespace?: string): Promise<Record<string, SharedContext>> {
    const contextDirectory = path.join(this.dataDirectory, 'context');
    const files = await fs.readdir(contextDirectory);
    const contexts: Record<string, SharedContext> = {};

    for (const file of files) {
      if (file.endsWith('.json')) {
        const context = await this.readJsonFile<SharedContext>(path.join(contextDirectory, file));

        if (context) {
          if (key && context.key !== key) {
            continue;
          }

          if (namespace && context.namespace !== namespace) {
            continue;
          }

          if (!context.ttl || Date.now() - context.timestamp < context.ttl) {
            contexts[context.key] = context;
          }
        }
      }
    }

    return contexts;
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

  async updateAgent(agentId: string, updates: Partial<AgentRegistration>): Promise<void> {
    const safeId = this.validatePathComponent(agentId);
    const filePath = path.join(this.dataDirectory, 'agents', `${safeId}.json`);
    const agent = await this.readJsonFile<AgentRegistration>(filePath);

    if (agent) {
      const updatedAgent = { ...agent, ...updates };

      await this.writeJsonFile(filePath, updatedAgent);
    }
  }

  async saveTask(task: TaskStatus): Promise<void> {
    const safeId = this.validatePathComponent(task.id);
    const filePath = path.join(this.dataDirectory, 'tasks', `${safeId}.json`);

    await this.writeJsonFile(filePath, task);
  }

  async getTasks(agent?: string): Promise<TaskStatus[]> {
    const tasksDirectory = path.join(this.dataDirectory, 'tasks');
    const files = await fs.readdir(tasksDirectory);
    const tasks: TaskStatus[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const task = await this.readJsonFile<TaskStatus>(path.join(tasksDirectory, file));

        if (task) {
          if (agent && task.agent !== agent) {
            continue;
          }

          tasks.push(task);
        }
      }
    }

    return tasks;
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
}
