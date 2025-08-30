import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStorage } from '~/storage';
import { TaskService } from '~/tasks/service';

import { AgentRegistration, Message, MessageType, TaskStatus } from '~/types';

// Mock the createId function
vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'mock-task-id-456'),
}));

describe('TaskService', () => {
  let taskService: TaskService;
  let mockStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      saveTask: vi.fn(),
      getAgents: vi.fn(),
      getTasks: vi.fn(),
      getMessages: vi.fn(),
    };
    taskService = new TaskService(mockStorage as FileStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateTaskStatus', () => {
    it('should create and save task with required fields', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus('agent1', 'implement feature X', 'started');

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 'mock-task-id-456',
        agent: 'agent1',
        task: 'implement feature X',
        status: 'started',
        details: undefined,
        dependencies: undefined,
        timestamp: mockTimestamp,
      });
    });

    it('should create task with optional fields', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus(
        'agent2',
        'fix bug in component Y',
        'in-progress',
        {
          details: 'Working on authentication flow',
          dependencies: ['task-1', 'task-2'],
        },
      );

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 'mock-task-id-456',
        agent: 'agent2',
        task: 'fix bug in component Y',
        status: 'in-progress',
        details: 'Working on authentication flow',
        dependencies: ['task-1', 'task-2'],
        timestamp: mockTimestamp,
      });
    });

    it('should handle all valid task statuses', async () => {
      const statuses: Array<'started' | 'in-progress' | 'completed' | 'blocked'> = [
        'started',
        'in-progress',
        'completed',
        'blocked',
      ];

      mockStorage.saveTask.mockResolvedValue(undefined);

      for (const status of statuses) {
        mockStorage.saveTask.mockClear();

        const result = await taskService.updateTaskStatus(
          'agent1',
          `task with ${status} status`,
          status,
        );

        expect(result.success).toBe(true);
        expect(mockStorage.saveTask).toHaveBeenCalledWith(
          expect.objectContaining({
            status,
          }),
        );
      }
    });

    it('should handle complex task descriptions', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const complexTask =
        'Implement user authentication with OAuth2, JWT tokens, and role-based permissions';
      const complexDetails =
        'Phase 1: OAuth setup\nPhase 2: JWT implementation\nPhase 3: Role system';

      const result = await taskService.updateTaskStatus(
        'backend-agent',
        complexTask,
        'in-progress',
        {
          details: complexDetails,
          dependencies: ['database-setup', 'api-framework'],
        },
      );

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task: complexTask,
          details: complexDetails,
        }),
      );
    });

    it('should handle storage errors', async () => {
      const error = new Error('Task storage error');

      mockStorage.saveTask.mockRejectedValue(error);

      await expect(taskService.updateTaskStatus('agent1', 'test task', 'started')).rejects.toThrow(
        'Task storage error',
      );
    });

    it('should handle empty dependencies array', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus('agent1', 'independent task', 'started', {
        dependencies: [],
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencies: [],
        }),
      );
    });
  });

  describe('getAgentStatus', () => {
    const mockAgents: AgentRegistration[] = [
      {
        id: 'agent1',
        projectPath: '/project1',
        role: 'Frontend Developer',
        capabilities: ['react', 'typescript'],
        status: 'active',
        lastSeen: Date.now(),
        collaboratesWith: ['agent2'],
      },
      {
        id: 'agent2',
        projectPath: '/project2',
        role: 'Backend Developer',
        capabilities: ['node', 'database'],
        status: 'active',
        lastSeen: Date.now(),
        collaboratesWith: ['agent1'],
      },
    ];

    const mockTasks: TaskStatus[] = [
      {
        id: 'task1',
        agent: 'agent1',
        task: 'Build login form',
        status: 'completed',
        timestamp: Date.now(),
      },
      {
        id: 'task2',
        agent: 'agent1',
        task: 'Style dashboard',
        status: 'in-progress',
        timestamp: Date.now(),
      },
    ];

    beforeEach(() => {
      mockStorage.getAgents.mockResolvedValue(mockAgents);
      mockStorage.getTasks.mockResolvedValue(mockTasks);
    });

    it('should get status for all agents when no agentId provided', async () => {
      const result = await taskService.getAgentStatus();

      expect(result.agents).toEqual(mockAgents);
      expect(result.tasks).toEqual(mockTasks);
      expect(mockStorage.getAgents).toHaveBeenCalledWith(undefined);
      expect(mockStorage.getTasks).toHaveBeenCalledWith(undefined);
    });

    it('should get status for specific agent', async () => {
      const specificAgents = [mockAgents[0]];
      const specificTasks = [mockTasks[0]];

      mockStorage.getAgents.mockResolvedValue(specificAgents);
      mockStorage.getTasks.mockResolvedValue(specificTasks);

      const result = await taskService.getAgentStatus('agent1');

      expect(result.agents).toEqual(specificAgents);
      expect(result.tasks).toEqual(specificTasks);
      expect(mockStorage.getAgents).toHaveBeenCalledWith('agent1');
      expect(mockStorage.getTasks).toHaveBeenCalledWith('agent1');
    });

    it('should handle empty results', async () => {
      mockStorage.getAgents.mockResolvedValue([]);
      mockStorage.getTasks.mockResolvedValue([]);

      const result = await taskService.getAgentStatus('non-existent-agent');

      expect(result.agents).toEqual([]);
      expect(result.tasks).toEqual([]);
    });

    it('should handle storage errors for agents', async () => {
      const error = new Error('Agent storage error');

      mockStorage.getAgents.mockRejectedValue(error);

      await expect(taskService.getAgentStatus()).rejects.toThrow('Agent storage error');
    });

    it('should handle storage errors for tasks', async () => {
      mockStorage.getAgents.mockResolvedValue(mockAgents);
      const error = new Error('Task storage error');

      mockStorage.getTasks.mockRejectedValue(error);

      await expect(taskService.getAgentStatus()).rejects.toThrow('Task storage error');
    });
  });

  describe('startCollaboration', () => {
    const baseTime = 1700000000000;
    const mockAgents: AgentRegistration[] = [
      {
        id: 'agent1',
        projectPath: '/project1',
        role: 'Frontend',
        capabilities: ['react'],
        status: 'active',
        lastSeen: baseTime - 1000, // 1 second ago (active)
        collaboratesWith: [],
      },
      {
        id: 'agent2',
        projectPath: '/project2',
        role: 'Backend',
        capabilities: ['node'],
        status: 'active',
        lastSeen: baseTime - 10 * 60 * 1000, // 10 minutes ago (inactive)
        collaboratesWith: [],
      },
    ];

    const mockMessages: Message[] = [
      {
        id: 'msg1',
        from: 'agent2',
        to: 'agent1',
        type: MessageType.CONTEXT,
        content: 'Unread message 1',
        timestamp: Date.now(),
        read: false,
        priority: 'normal' as any,
      },
      {
        id: 'msg2',
        from: 'agent3',
        to: 'agent1',
        type: MessageType.TASK,
        content: 'Read message',
        timestamp: Date.now(),
        read: true,
        priority: 'normal' as any,
      },
      {
        id: 'msg3',
        from: 'agent4',
        to: 'agent1',
        type: MessageType.QUESTION,
        content: 'Unread message 2',
        timestamp: Date.now(),
        read: false,
        priority: 'high' as any,
      },
    ];

    beforeEach(() => {
      mockStorage.getAgents.mockResolvedValue(mockAgents);
      mockStorage.getMessages.mockResolvedValue(mockMessages);
    });

    it('should start collaboration with provided agent ID', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(baseTime);

      const result = await taskService.startCollaboration('feature-auth', 'test-agent');

      expect(result.agent).toBe('test-agent');
      expect(result.activeAgents).toEqual(['agent1']); // Only agent1 is active (within 5 minutes)
      expect(result.pendingMessages).toBe(2); // 2 unread messages
      expect(mockStorage.getMessages).toHaveBeenCalledWith({ agent: 'test-agent' });
    });

    it('should generate agent ID when not provided', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(baseTime);

      const result = await taskService.startCollaboration('feature-payments');

      expect(result.agent).toBe(`agent-${baseTime}`);
      expect(result.activeAgents).toEqual(['agent1']);
      expect(result.pendingMessages).toBe(2);
      expect(mockStorage.getMessages).toHaveBeenCalledWith({ agent: `agent-${baseTime}` });
    });

    it('should correctly identify active agents within 5 minute window', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      // Create agents with different last seen times
      const testAgents: AgentRegistration[] = [
        {
          id: 'very-recent',
          projectPath: '/p1',
          role: 'Dev',
          capabilities: [],
          status: 'active',
          lastSeen: mockTimestamp - 30 * 1000, // 30 seconds ago (active)
          collaboratesWith: [],
        },
        {
          id: 'just-active',
          projectPath: '/p2',
          role: 'Dev',
          capabilities: [],
          status: 'active',
          lastSeen: mockTimestamp - 4.5 * 60 * 1000, // 4.5 minutes ago (active)
          collaboratesWith: [],
        },
        {
          id: 'just-inactive',
          projectPath: '/p3',
          role: 'Dev',
          capabilities: [],
          status: 'active',
          lastSeen: mockTimestamp - 6 * 60 * 1000, // 6 minutes ago (inactive)
          collaboratesWith: [],
        },
        {
          id: 'very-old',
          projectPath: '/p4',
          role: 'Dev',
          capabilities: [],
          status: 'active',
          lastSeen: mockTimestamp - 60 * 60 * 1000, // 1 hour ago (inactive)
          collaboratesWith: [],
        },
      ];

      mockStorage.getAgents.mockResolvedValue(testAgents);

      const result = await taskService.startCollaboration('feature-test', 'test-agent');

      expect(result.activeAgents).toEqual(['very-recent', 'just-active']);
    });

    it('should count only unread messages', async () => {
      const testMessages: Message[] = [
        {
          id: '1',
          from: 'a1',
          to: 'agent',
          type: MessageType.CONTEXT,
          content: 'msg1',
          timestamp: Date.now(),
          read: false,
          priority: 'normal' as any,
        },
        {
          id: '2',
          from: 'a2',
          to: 'agent',
          type: MessageType.CONTEXT,
          content: 'msg2',
          timestamp: Date.now(),
          read: true,
          priority: 'normal' as any,
        },
        {
          id: '3',
          from: 'a3',
          to: 'agent',
          type: MessageType.CONTEXT,
          content: 'msg3',
          timestamp: Date.now(),
          read: false,
          priority: 'normal' as any,
        },
        {
          id: '4',
          from: 'a4',
          to: 'agent',
          type: MessageType.CONTEXT,
          content: 'msg4',
          timestamp: Date.now(),
          read: true,
          priority: 'normal' as any,
        },
        {
          id: '5',
          from: 'a5',
          to: 'agent',
          type: MessageType.CONTEXT,
          content: 'msg5',
          timestamp: Date.now(),
          read: false,
          priority: 'normal' as any,
        },
      ];

      mockStorage.getMessages.mockResolvedValue(testMessages);

      const result = await taskService.startCollaboration('feature-test', 'test-agent');

      expect(result.pendingMessages).toBe(3); // 3 unread messages
    });

    it('should handle no active agents', async () => {
      const inactiveAgents: AgentRegistration[] = [
        {
          id: 'inactive-agent',
          projectPath: '/project',
          role: 'Developer',
          capabilities: [],
          status: 'active',
          lastSeen: Date.now() - 10 * 60 * 1000, // 10 minutes ago
          collaboratesWith: [],
        },
      ];

      mockStorage.getAgents.mockResolvedValue(inactiveAgents);

      const result = await taskService.startCollaboration('feature-test', 'test-agent');

      expect(result.activeAgents).toEqual([]);
    });

    it('should handle no pending messages', async () => {
      const readMessages: Message[] = [
        {
          id: '1',
          from: 'a1',
          to: 'agent',
          type: MessageType.CONTEXT,
          content: 'read msg',
          timestamp: Date.now(),
          read: true,
          priority: 'normal' as any,
        },
      ];

      mockStorage.getMessages.mockResolvedValue(readMessages);

      const result = await taskService.startCollaboration('feature-test', 'test-agent');

      expect(result.pendingMessages).toBe(0);
    });

    it('should handle storage errors for agents', async () => {
      const error = new Error('Agents storage error');

      mockStorage.getAgents.mockRejectedValue(error);

      await expect(taskService.startCollaboration('feature-test', 'test-agent')).rejects.toThrow(
        'Agents storage error',
      );
    });

    it('should handle storage errors for messages', async () => {
      mockStorage.getAgents.mockResolvedValue(mockAgents);
      const error = new Error('Messages storage error');

      mockStorage.getMessages.mockRejectedValue(error);

      await expect(taskService.startCollaboration('feature-test', 'test-agent')).rejects.toThrow(
        'Messages storage error',
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty task description', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus('agent1', '', 'started');

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task: '',
        }),
      );
    });

    it('should handle very long task descriptions', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);
      const longTask = 'x'.repeat(10000);

      const result = await taskService.updateTaskStatus('agent1', longTask, 'started');

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task: longTask,
        }),
      );
    });

    it('should handle special characters in task description', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);
      const specialTask = 'Task\n\t<script>alert("test")</script>\r\n';

      const result = await taskService.updateTaskStatus('agent1', specialTask, 'started');

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task: specialTask,
        }),
      );
    });

    it('should handle null details', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus('agent1', 'test task', 'started', {
        details: null as any,
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          details: null,
        }),
      );
    });

    it('should handle undefined in dependencies array', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus('agent1', 'test task', 'started', {
        dependencies: [undefined, 'task-1', null, 'task-2'] as any,
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencies: [undefined, 'task-1', null, 'task-2'],
        }),
      );
    });

    it('should handle very long dependencies list', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);
      const longDependencies = Array(1000)
        .fill(0)
        .map((_, index) => `task-${index}`);

      const result = await taskService.updateTaskStatus('agent1', 'test task', 'started', {
        dependencies: longDependencies,
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencies: longDependencies,
        }),
      );
    });

    it('should handle invalid task status gracefully', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus(
        'agent1',
        'test task',
        'invalid-status' as any,
      );

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'invalid-status',
        }),
      );
    });

    it('should handle circular dependencies', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const result = await taskService.updateTaskStatus('agent1', 'task-a', 'started', {
        dependencies: ['task-b', 'task-c', 'task-a'], // Includes self
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencies: ['task-b', 'task-c', 'task-a'],
        }),
      );
    });

    it('should handle getAgentStatus with null/undefined from storage', async () => {
      mockStorage.getAgents.mockResolvedValue(null);
      mockStorage.getTasks.mockResolvedValue(undefined);

      const result = await taskService.getAgentStatus();

      expect(result.agents).toEqual([]);
      expect(result.tasks).toEqual([]);
    });

    it('should handle agents with missing required fields', async () => {
      const incompleteAgents = [
        {
          id: 'incomplete-agent',
          // Missing other required fields
        } as any,
      ];

      mockStorage.getAgents.mockResolvedValue(incompleteAgents);
      mockStorage.getTasks.mockResolvedValue([]);

      const result = await taskService.getAgentStatus();

      expect(result.agents).toEqual(incompleteAgents);
    });

    it('should handle tasks with missing fields', async () => {
      const incompleteTasks = [
        {
          id: 'incomplete-task',
          agent: 'agent1',
          // Missing other fields
        } as any,
      ];

      mockStorage.getAgents.mockResolvedValue([]);
      mockStorage.getTasks.mockResolvedValue(incompleteTasks);

      const result = await taskService.getAgentStatus();

      expect(result.tasks).toEqual(incompleteTasks);
    });

    it('should handle startCollaboration with empty agent lists', async () => {
      mockStorage.getAgents.mockResolvedValue([]);
      mockStorage.getMessages.mockResolvedValue([]);

      const result = await taskService.startCollaboration('feature', 'agent');

      expect(result.activeAgents).toEqual([]);
      expect(result.pendingMessages).toBe(0);
    });

    it('should handle startCollaboration with invalid lastSeen timestamps', async () => {
      const invalidAgents: AgentRegistration[] = [
        {
          id: 'agent-nan',
          projectPath: '/project',
          role: 'Dev',
          capabilities: [],
          status: 'active',
          lastSeen: NaN,
          collaboratesWith: [],
        },
        {
          id: 'agent-negative',
          projectPath: '/project',
          role: 'Dev',
          capabilities: [],
          status: 'active',
          lastSeen: -1000,
          collaboratesWith: [],
        },
        {
          id: 'agent-future',
          projectPath: '/project',
          role: 'Dev',
          capabilities: [],
          status: 'active',
          lastSeen: Date.now() + 1000000,
          collaboratesWith: [],
        },
      ];

      mockStorage.getAgents.mockResolvedValue(invalidAgents);
      mockStorage.getMessages.mockResolvedValue([]);

      const result = await taskService.startCollaboration('feature', 'agent');

      // Should handle gracefully - implementation specific
      expect(result).toHaveProperty('activeAgents');
      expect(result).toHaveProperty('pendingMessages');
    });

    it('should handle messages with invalid read status', async () => {
      const invalidMessages: Message[] = [
        {
          id: 'msg1',
          from: 'agent1',
          to: 'agent2',
          type: MessageType.CONTEXT,
          content: 'Test',
          timestamp: Date.now(),
          read: 'yes' as any, // Invalid boolean
          priority: 'normal' as any,
        },
        {
          id: 'msg2',
          from: 'agent1',
          to: 'agent2',
          type: MessageType.CONTEXT,
          content: 'Test',
          timestamp: Date.now(),
          read: 1 as any, // Invalid boolean
          priority: 'normal' as any,
        },
      ];

      mockStorage.getAgents.mockResolvedValue([]);
      mockStorage.getMessages.mockResolvedValue(invalidMessages);

      const result = await taskService.startCollaboration('feature', 'agent');

      // Should handle gracefully
      expect(result.pendingMessages).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle concurrent task updates for same agent', async () => {
      mockStorage.saveTask.mockResolvedValue(undefined);

      const tasks = [
        { task: 'Task 1', status: 'started' as const },
        { task: 'Task 2', status: 'in-progress' as const },
        { task: 'Task 3', status: 'completed' as const },
      ];

      const promises = tasks.map(({ status, task }) =>
        taskService.updateTaskStatus('concurrent-agent', task, status),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockStorage.saveTask).toHaveBeenCalledTimes(3);
    });

    it('should handle collaboration with complex agent ecosystem', async () => {
      const complexAgents: AgentRegistration[] = [
        {
          id: 'frontend-1',
          projectPath: '/fe1',
          role: 'React Dev',
          capabilities: ['react', 'ts'],
          status: 'active',
          lastSeen: Date.now() - 1000,
          collaboratesWith: ['backend-1'],
        },
        {
          id: 'frontend-2',
          projectPath: '/fe2',
          role: 'Vue Dev',
          capabilities: ['vue', 'ts'],
          status: 'active',
          lastSeen: Date.now() - 2 * 60 * 1000,
          collaboratesWith: ['backend-2'],
        },
        {
          id: 'backend-1',
          projectPath: '/be1',
          role: 'Node Dev',
          capabilities: ['node', 'db'],
          status: 'active',
          lastSeen: Date.now() - 1.5 * 60 * 1000,
          collaboratesWith: ['frontend-1', 'database-1'],
        },
        {
          id: 'backend-2',
          projectPath: '/be2',
          role: 'Python Dev',
          capabilities: ['python', 'ai'],
          status: 'active',
          lastSeen: Date.now() - 10 * 60 * 1000,
          collaboratesWith: ['frontend-2'],
        },
        {
          id: 'database-1',
          projectPath: '/db',
          role: 'DBA',
          capabilities: ['postgres', 'redis'],
          status: 'active',
          lastSeen: Date.now() - 3 * 60 * 1000,
          collaboratesWith: ['backend-1'],
        },
      ];

      const complexMessages: Message[] = Array.from({ length: 15 }, (_, index) => ({
        id: `msg-${index}`,
        from: `agent-${index % 3}`,
        to: 'collaboration-agent',
        type: MessageType.CONTEXT,
        content: `Message ${index}`,
        timestamp: Date.now() - index * 1000,
        read: index % 3 === 0, // Every 3rd message is read
        priority: 'normal' as any,
      }));

      mockStorage.getAgents.mockResolvedValue(complexAgents);
      mockStorage.getMessages.mockResolvedValue(complexMessages);

      const result = await taskService.startCollaboration('complex-feature', 'collaboration-agent');

      expect(result.agent).toBe('collaboration-agent');
      // Should include agents active within 5 minutes (4 out of 5 agents)
      expect(result.activeAgents).toHaveLength(4);
      expect(result.activeAgents).not.toContain('backend-2'); // Inactive (10 min ago)
      // Should count unread messages (10 out of 15)
      expect(result.pendingMessages).toBe(10);
    });
  });
});
