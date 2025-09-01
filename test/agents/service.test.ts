import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentService } from '~/agents/service';
import { FeaturesService } from '~/features/service';
import { MessageService } from '~/messaging/service';
import { StorageAdapter } from '~/storage';

import { AgentRegistration, MessagePriority, MessageType } from '~/types';

describe('AgentService', () => {
  let agentService: AgentService;
  let mockStorage: any;
  let mockFeaturesService: any;
  let mockMessageService: any;

  const mockAgents: AgentRegistration[] = [
    {
      id: 'agent-1',
      projectPath: '/path/to/project1',
      role: 'Frontend Developer',
      capabilities: ['react', 'typescript'],
      status: 'active',
      lastSeen: Date.now(),
      collaboratesWith: ['agent-2'],
    },
    {
      id: 'agent-2',
      projectPath: '/path/to/project2',
      role: 'Backend Developer',
      capabilities: ['nodejs', 'express'],
      status: 'active',
      lastSeen: Date.now(),
      collaboratesWith: ['agent-1'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock storage
    mockStorage = {
      getAgents: vi.fn(),
    };

    // Mock FeaturesService
    mockFeaturesService = {
      getAgentWorkload: vi.fn(),
    };

    // Mock MessageService
    mockMessageService = {
      getMessages: vi.fn(),
    };

    agentService = new AgentService(
      mockStorage as StorageAdapter,
      mockFeaturesService as FeaturesService,
      mockMessageService as MessageService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAgentStatus', () => {
    describe('without agentId (get all agents)', () => {
      it('should return all agents with empty features and no messages', async () => {
        mockStorage.getAgents.mockResolvedValue(mockAgents);

        const result = await agentService.getAgentStatus();

        expect(result).toEqual({
          agents: mockAgents,
          features: { activeFeatures: [] },
          messages: undefined,
        });

        expect(mockStorage.getAgents).toHaveBeenCalledWith(undefined);
        expect(mockFeaturesService.getAgentWorkload).not.toHaveBeenCalled();
        expect(mockMessageService.getMessages).not.toHaveBeenCalled();
      });

      it('should handle empty agent list', async () => {
        mockStorage.getAgents.mockResolvedValue([]);

        const result = await agentService.getAgentStatus();

        expect(result).toEqual({
          agents: [],
          features: { activeFeatures: [] },
          messages: undefined,
        });
      });

      it('should handle null agents response', async () => {
        mockStorage.getAgents.mockResolvedValue(null);

        const result = await agentService.getAgentStatus();

        expect(result).toEqual({
          agents: [],
          features: { activeFeatures: [] },
          messages: undefined,
        });
      });
    });

    describe('with specific agentId', () => {
      it('should return agent with features and messages', async () => {
        const agentId = 'agent-1';
        const mockFeatures = {
          activeFeatures: [
            {
              id: 'feature-1',
              name: 'user-auth',
              title: 'User Authentication',
              status: 'active',
            },
          ],
          delegations: [
            {
              id: 'delegation-1',
              taskId: 'task-1',
              agentId: 'agent-1',
              scope: 'Implement login form',
              status: 'accepted',
            },
          ],
        };
        const mockMessages = {
          messages: [
            {
              id: 'msg-1',
              from: 'agent-2',
              to: 'agent-1',
              type: MessageType.CONTEXT,
              content: 'API endpoints ready',
              timestamp: Date.now(),
              read: false,
              priority: MessagePriority.NORMAL,
            },
            {
              id: 'msg-2',
              from: 'agent-hub',
              to: 'agent-1',
              type: MessageType.TASK,
              content: 'New task assigned',
              timestamp: Date.now(),
              read: true,
              priority: MessagePriority.NORMAL,
            },
          ],
        };

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue(mockFeatures);
        mockMessageService.getMessages.mockResolvedValue(mockMessages);

        const result = await agentService.getAgentStatus(agentId);

        expect(result).toEqual({
          agents: [mockAgents[0]],
          features: mockFeatures,
          messages: {
            totalCount: 2,
            unreadCount: 1,
          },
        });

        expect(mockStorage.getAgents).toHaveBeenCalledWith(agentId);
        expect(mockFeaturesService.getAgentWorkload).toHaveBeenCalledWith(agentId);
        expect(mockMessageService.getMessages).toHaveBeenCalledWith(agentId, {
          markAsRead: false,
        });
      });

      it('should handle agent with no messages', async () => {
        const agentId = 'agent-1';
        const mockFeatures = { activeFeatures: [] };
        const mockMessages = { messages: [] };

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue(mockFeatures);
        mockMessageService.getMessages.mockResolvedValue(mockMessages);

        const result = await agentService.getAgentStatus(agentId);

        expect(result).toEqual({
          agents: [mockAgents[0]],
          features: mockFeatures,
          messages: {
            totalCount: 0,
            unreadCount: 0,
          },
        });
      });

      it('should handle all read messages', async () => {
        const agentId = 'agent-1';
        const mockFeatures = { activeFeatures: [] };
        const mockMessages = {
          messages: [
            {
              id: 'msg-1',
              from: 'agent-2',
              to: 'agent-1',
              type: MessageType.CONTEXT,
              content: 'Test message',
              timestamp: Date.now(),
              read: true,
              priority: MessagePriority.NORMAL,
            },
          ],
        };

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue(mockFeatures);
        mockMessageService.getMessages.mockResolvedValue(mockMessages);

        const result = await agentService.getAgentStatus(agentId);

        expect(result.messages).toEqual({
          totalCount: 1,
          unreadCount: 0,
        });
      });

      it('should gracefully handle message service errors', async () => {
        const agentId = 'agent-1';
        const mockFeatures = { activeFeatures: [] };

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue(mockFeatures);
        mockMessageService.getMessages.mockRejectedValue(new Error('Database error'));

        const result = await agentService.getAgentStatus(agentId);

        expect(result).toEqual({
          agents: [mockAgents[0]],
          features: mockFeatures,
          messages: {
            totalCount: 0,
            unreadCount: 0,
          },
        });

        // Should not throw error
        expect(mockMessageService.getMessages).toHaveBeenCalledWith(agentId, {
          markAsRead: false,
        });
      });

      it('should handle non-existent agent', async () => {
        const agentId = 'non-existent';

        mockStorage.getAgents.mockResolvedValue(null);
        mockFeaturesService.getAgentWorkload.mockResolvedValue({ activeFeatures: [] });

        const result = await agentService.getAgentStatus(agentId);

        expect(result).toEqual({
          agents: [],
          features: { activeFeatures: [] },
          messages: {
            totalCount: 0,
            unreadCount: 0,
          },
        });
      });

      it('should handle complex workload data', async () => {
        const agentId = 'agent-1';
        const mockFeatures = {
          activeFeatures: [
            { id: 'feature-1', name: 'auth', status: 'active' },
            { id: 'feature-2', name: 'payment', status: 'planning' },
          ],
          delegations: [
            { id: 'del-1', agentId, status: 'accepted' },
            { id: 'del-2', agentId, status: 'pending' },
          ],
          subtasks: [
            { id: 'sub-1', title: 'Implement login', status: 'completed' },
            { id: 'sub-2', title: 'Add validation', status: 'in-progress' },
          ],
        };

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue(mockFeatures);
        mockMessageService.getMessages.mockResolvedValue({ messages: [] });

        const result = await agentService.getAgentStatus(agentId);

        expect(result.features).toEqual(mockFeatures);
      });
    });

    describe('error handling', () => {
      it('should handle storage errors gracefully', async () => {
        mockStorage.getAgents.mockRejectedValue(new Error('Storage unavailable'));

        await expect(agentService.getAgentStatus()).rejects.toThrow('Storage unavailable');
      });

      it('should handle features service errors', async () => {
        const agentId = 'agent-1';

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockRejectedValue(new Error('Features service error'));
        mockMessageService.getMessages.mockResolvedValue({ messages: [] });

        await expect(agentService.getAgentStatus(agentId)).rejects.toThrow(
          'Features service error',
        );
      });

      it('should not throw when message service fails but continue with default values', async () => {
        const agentId = 'agent-1';

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue({ activeFeatures: [] });
        mockMessageService.getMessages.mockRejectedValue(new Error('Message service down'));

        const result = await agentService.getAgentStatus(agentId);

        expect(result.messages).toEqual({
          totalCount: 0,
          unreadCount: 0,
        });
      });
    });

    describe('data filtering', () => {
      it('should correctly count unread messages', async () => {
        const agentId = 'agent-1';
        const mockMessages = {
          messages: [
            { id: '1', read: false },
            { id: '2', read: true },
            { id: '3', read: false },
            { id: '4', read: false },
            { id: '5', read: true },
          ],
        };

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue({ activeFeatures: [] });
        mockMessageService.getMessages.mockResolvedValue(mockMessages);

        const result = await agentService.getAgentStatus(agentId);

        expect(result.messages).toEqual({
          totalCount: 5,
          unreadCount: 3,
        });
      });

      it('should handle undefined read property as unread', async () => {
        const agentId = 'agent-1';
        const mockMessages = {
          messages: [
            { id: '1', read: false },
            { id: '2', read: undefined },
            { id: '3' }, // no read property
          ],
        };

        mockStorage.getAgents.mockResolvedValue([mockAgents[0]]);
        mockFeaturesService.getAgentWorkload.mockResolvedValue({ activeFeatures: [] });
        mockMessageService.getMessages.mockResolvedValue(mockMessages);

        const result = await agentService.getAgentStatus(agentId);

        expect(result.messages?.unreadCount).toBe(3);
      });
    });
  });
});
