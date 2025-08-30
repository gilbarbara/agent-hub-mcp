import { createId } from '@paralleldrive/cuid2';

import { StorageAdapter } from '~/storage';

import { TaskStatus } from '~/types';

export class TaskService {
  constructor(private readonly storage: StorageAdapter) {}

  async updateTaskStatus(
    agent: string,
    task: string,
    status: 'started' | 'in-progress' | 'completed' | 'blocked',
    options: {
      dependencies?: string[];
      details?: string;
    } = {},
  ): Promise<{ success: boolean }> {
    const taskStatus: TaskStatus = {
      id: createId(),
      agent,
      task,
      status,
      details: options.details,
      dependencies: options.dependencies,
      timestamp: Date.now(),
    };

    await this.storage.saveTask(taskStatus);

    return { success: true };
  }

  async getAgentStatus(agentId?: string): Promise<{ agents: any[]; tasks: any[] }> {
    const agents = await this.storage.getAgents(agentId);
    const tasks = await this.storage.getTasks(agentId);

    return {
      agents: agents ?? [],
      tasks: tasks ?? [],
    };
  }

  async startCollaboration(
    _feature: string,
    agentId?: string,
  ): Promise<{
    activeAgents: string[];
    agent: string;
    pendingMessages: number;
  }> {
    const id = agentId ?? `agent-${Date.now()}`;
    const agents = await this.storage.getAgents();
    const messages = await this.storage.getMessages({ agent: id });

    const activeAgents = agents.filter(a => Date.now() - a.lastSeen < 5 * 60 * 1000).map(a => a.id);

    const pendingMessages = messages.filter(m => !m.read).length;

    return {
      agent: id,
      pendingMessages,
      activeAgents,
    };
  }
}
