import * as fs from 'fs/promises';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStorage } from '../src/storage.js';
import {
  AgentRegistration,
  Message,
  MessagePriority,
  MessageType,
  SharedContext,
  TaskStatus,
} from '../src/types.js';

vi.mock('fs/promises');

describe('FileStorage', () => {
  let storage: FileStorage;
  const testDataDirectory = path.resolve('.test-agent-hub');

  beforeEach(() => {
    storage = new FileStorage('.test-agent-hub');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('should create required directories', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await storage.init();

      expect(fs.mkdir).toHaveBeenCalledTimes(4);
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(testDataDirectory, 'messages'), {
        recursive: true,
      });
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(testDataDirectory, 'context'), {
        recursive: true,
      });
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(testDataDirectory, 'agents'), {
        recursive: true,
      });
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(testDataDirectory, 'tasks'), {
        recursive: true,
      });
    });
  });

  describe('messages', () => {
    const mockMessage: Message = {
      id: 'test-id',
      from: 'agent1',
      to: 'agent2',
      type: MessageType.CONTEXT,
      content: 'Test message',
      timestamp: Date.now(),
      read: false,
      priority: MessagePriority.NORMAL,
    };

    it('should save a message', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      await storage.saveMessage(mockMessage);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDirectory, 'messages', 'test-id.json'),
        JSON.stringify(mockMessage, null, 2),
      );
    });

    it('should get messages with filters', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['message1.json', 'message2.json'] as any);
      vi.mocked(fs.readFile).mockImplementation(filePath => {
        if (filePath.toString().includes('message1')) {
          return Promise.resolve(JSON.stringify({ ...mockMessage, to: 'agent2' }));
        }

        return Promise.resolve(JSON.stringify({ ...mockMessage, to: 'agent3' }));
      });

      const messages = await storage.getMessages({ agent: 'agent2' });

      expect(messages).toHaveLength(1);
      expect(messages[0].to).toBe('agent2');
    });

    it('should mark message as read', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessage));
      vi.mocked(fs.writeFile).mockResolvedValue();

      await storage.markMessageAsRead('test-id');

      expect(fs.readFile).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDirectory, 'messages', 'test-id.json'),
        expect.stringContaining('"read": true'),
      );
    });
  });

  describe('context', () => {
    const mockContext: SharedContext = {
      key: 'test-key',
      value: { data: 'test' },
      version: 1,
      updatedBy: 'agent1',
      timestamp: Date.now(),
    };

    it('should save context', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      await storage.saveContext(mockContext);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDirectory, 'context', 'test-key.json'),
        JSON.stringify(mockContext, null, 2),
      );
    });

    it('should get context with TTL check', async () => {
      const expiredContext = { ...mockContext, ttl: 1000, timestamp: Date.now() - 2000 };
      const validContext = { ...mockContext, key: 'valid-key', ttl: 10000, timestamp: Date.now() };

      vi.mocked(fs.readdir).mockResolvedValue(['expired.json', 'valid.json'] as any);
      vi.mocked(fs.readFile).mockImplementation(filePath => {
        if (filePath.toString().includes('expired')) {
          return Promise.resolve(JSON.stringify(expiredContext));
        }

        return Promise.resolve(JSON.stringify(validContext));
      });

      const contexts = await storage.getContext();

      expect(Object.keys(contexts)).toHaveLength(1);
      expect(contexts['valid-key']).toBeDefined();
    });
  });

  describe('agents', () => {
    const mockAgent: AgentRegistration = {
      id: 'agent1',
      projectPath: '/test/path',
      role: 'Test Agent',
      capabilities: ['test'],
      status: 'active',
      lastSeen: Date.now(),
      collaboratesWith: ['agent2'],
    };

    it('should save an agent', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      await storage.saveAgent(mockAgent);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDirectory, 'agents', 'agent1.json'),
        JSON.stringify(mockAgent, null, 2),
      );
    });

    it('should get agents', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['agent1.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockAgent));

      const agents = await storage.getAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent1');
    });
  });

  describe('tasks', () => {
    const mockTask: TaskStatus = {
      id: 'task1',
      agent: 'agent1',
      task: 'Test task',
      status: 'in-progress',
      timestamp: Date.now(),
    };

    it('should save a task', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      await storage.saveTask(mockTask);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDirectory, 'tasks', 'task1.json'),
        JSON.stringify(mockTask, null, 2),
      );
    });

    it('should get tasks filtered by agent', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['task1.json', 'task2.json'] as any);
      vi.mocked(fs.readFile).mockImplementation(filePath => {
        if (filePath.toString().includes('task1')) {
          return Promise.resolve(JSON.stringify(mockTask));
        }

        return Promise.resolve(JSON.stringify({ ...mockTask, agent: 'agent2' }));
      });

      const tasks = await storage.getTasks('agent1');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].agent).toBe('agent1');
    });
  });

  describe('cleanup', () => {
    it('should delete old messages', async () => {
      const oldMessage = {
        id: 'old',
        from: 'agent1',
        to: 'agent2',
        type: MessageType.CONTEXT,
        content: 'Old message',
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
        read: true,
      };

      vi.mocked(fs.readdir).mockResolvedValue(['old.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(oldMessage));
      vi.mocked(fs.unlink).mockResolvedValue();

      await storage.cleanup(7);

      expect(fs.unlink).toHaveBeenCalledWith(path.join(testDataDirectory, 'messages', 'old.json'));
    });
  });
});
