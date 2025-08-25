import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { AgentRegistration, Message, SharedContext, TaskStatus } from './types';

export class FileStorage {
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

    // Only allow alphanumeric, dash, underscore, and dot (for extensions)
    if (!/^[\w.-]+$/.test(sanitized)) {
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
    since?: number;
    type?: string;
  }): Promise<Message[]> {
    const messagesDirectory = path.join(this.dataDirectory, 'messages');
    const files = await fs.readdir(messagesDirectory);
    const messages: Message[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const message = await this.readJsonFile<Message>(path.join(messagesDirectory, file));

        if (message) {
          if (filter) {
            if (filter.agent && message.to !== filter.agent && message.to !== 'all') {
              continue;
            }

            if (filter.type && message.type !== filter.type) {
              continue;
            }

            if (filter.since && message.timestamp < filter.since) {
              continue;
            }
          }

          messages.push(message);
        }
      }
    }

    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const safeId = this.validatePathComponent(messageId);
    const filePath = path.join(this.dataDirectory, 'messages', `${safeId}.json`);
    const message = await this.readJsonFile<Message>(filePath);

    return message || undefined;
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    const safeId = this.validatePathComponent(messageId);
    const filePath = path.join(this.dataDirectory, 'messages', `${safeId}.json`);
    const message = await this.readJsonFile<Message>(filePath);

    if (message) {
      message.read = true;
      await this.writeJsonFile(filePath, message);
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
