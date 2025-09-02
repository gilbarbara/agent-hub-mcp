import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentService } from '~/agents/service';
import { FeaturesService } from '~/features/service';
import { MessageService } from '~/messaging/service';
import { StorageAdapter } from '~/storage';

import { AgentRegistration } from '~/types';

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
      lastSeen: Date.now() - 10 * 60 * 1000, // 10 minutes ago (inactive)
      collaboratesWith: ['agent-1'],
    },
  ];

  const mockFeatures = [
    {
      id: 'feature-1',
      title: 'User Authentication',
      status: 'active',
      priority: 'high',
    },
    {
      id: 'feature-2',
      title: 'Dashboard UI',
      status: 'active',
      priority: 'normal',
    },
    {
      id: 'feature-3',
      title: 'Settings Page',
      status: 'completed',
      priority: 'low',
    },
  ];

  const mockMessages = [
    {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      content: 'Test message',
      read: false,
      timestamp: Date.now(),
    },
    {
      id: 'msg-2',
      from: 'agent-2',
      to: 'agent-1',
      content: 'Another message',
      read: true,
      timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
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
      getFeatures: vi.fn(),
    };

    // Mock MessageService
    mockMessageService = {
      getAllMessages: vi.fn(),
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

  describe('getAllAgents', () => {
    it('should return all agents from storage', async () => {
      mockStorage.getAgents.mockResolvedValue(mockAgents);

      const result = await agentService.getAllAgents();

      expect(result).toEqual(mockAgents);
      expect(mockStorage.getAgents).toHaveBeenCalledWith();
    });

    it('should handle empty agent list', async () => {
      mockStorage.getAgents.mockResolvedValue([]);

      const result = await agentService.getAllAgents();

      expect(result).toEqual([]);
    });
  });

  describe('getHubStatus', () => {
    it('should return comprehensive hub status with active/inactive agents', async () => {
      mockStorage.getAgents.mockResolvedValue(mockAgents);
      mockFeaturesService.getFeatures.mockResolvedValue(mockFeatures);
      mockMessageService.getAllMessages.mockResolvedValue(mockMessages);

      const result = await agentService.getHubStatus();

      expect(result).toEqual({
        agents: {
          total: 2,
          active: [mockAgents[0]], // Only agent-1 is active (within 5 min)
          inactive: [mockAgents[1]], // agent-2 is inactive (10 min ago)
        },
        features: {
          total: 3,
          active: [mockFeatures[0], mockFeatures[1]], // Only active features
          byPriority: {
            critical: 0,
            high: 1,
            normal: 1,
            low: 1,
          },
        },
        messages: {
          totalUnread: 1, // Only msg-1 is unread
          recentActivity: 1, // Only msg-1 is from last hour
        },
      });
    });

    it('should handle empty data gracefully', async () => {
      mockStorage.getAgents.mockResolvedValue([]);
      mockFeaturesService.getFeatures.mockResolvedValue([]);
      mockMessageService.getAllMessages.mockResolvedValue([]);

      const result = await agentService.getHubStatus();

      expect(result).toEqual({
        agents: {
          total: 0,
          active: [],
          inactive: [],
        },
        features: {
          total: 0,
          active: [],
          byPriority: {
            critical: 0,
            high: 0,
            normal: 0,
            low: 0,
          },
        },
        messages: {
          totalUnread: 0,
          recentActivity: 0,
        },
      });
    });

    it('should correctly categorize agents by activity (5 minute threshold)', async () => {
      const now = Date.now();
      const agentsWithVariedActivity: AgentRegistration[] = [
        {
          id: 'active-1',
          projectPath: '/path1',
          role: 'Developer',
          capabilities: [],
          status: 'active',
          lastSeen: now - 2 * 60 * 1000, // 2 minutes ago (active)
          collaboratesWith: [],
        },
        {
          id: 'active-2',
          projectPath: '/path2',
          role: 'Developer',
          capabilities: [],
          status: 'active',
          lastSeen: now - 4 * 60 * 1000, // 4 minutes ago (active)
          collaboratesWith: [],
        },
        {
          id: 'inactive-1',
          projectPath: '/path3',
          role: 'Developer',
          capabilities: [],
          status: 'active',
          lastSeen: now - 6 * 60 * 1000, // 6 minutes ago (inactive)
          collaboratesWith: [],
        },
      ];

      mockStorage.getAgents.mockResolvedValue(agentsWithVariedActivity);
      mockFeaturesService.getFeatures.mockResolvedValue([]);
      mockMessageService.getAllMessages.mockResolvedValue([]);

      const result = await agentService.getHubStatus();

      expect(result.agents.active).toHaveLength(2);
      expect(result.agents.inactive).toHaveLength(1);
      expect(result.agents.active.map(a => a.id)).toEqual(['active-1', 'active-2']);
      expect(result.agents.inactive.map(a => a.id)).toEqual(['inactive-1']);
    });

    it('should correctly categorize features by status and priority', async () => {
      const mixedFeatures = [
        { id: 'f1', status: 'active', priority: 'critical' },
        { id: 'f2', status: 'active', priority: 'high' },
        { id: 'f3', status: 'completed', priority: 'normal' },
        { id: 'f4', status: 'active', priority: 'low' },
        { id: 'f5', status: 'active', priority: 'critical' },
      ];

      mockStorage.getAgents.mockResolvedValue([]);
      mockFeaturesService.getFeatures.mockResolvedValue(mixedFeatures);
      mockMessageService.getAllMessages.mockResolvedValue([]);

      const result = await agentService.getHubStatus();

      expect(result.features.total).toBe(5);
      expect(result.features.active).toHaveLength(4); // Only active features
      expect(result.features.byPriority).toEqual({
        critical: 2,
        high: 1,
        normal: 1,
        low: 1,
      });
    });

    it('should correctly calculate message activity (1 hour threshold)', async () => {
      const now = Date.now();
      const mixedMessages = [
        {
          id: 'm1',
          from: 'a1',
          to: 'a2',
          read: false,
          timestamp: now - 30 * 60 * 1000, // 30 min ago (recent, unread)
        },
        {
          id: 'm2',
          from: 'a2',
          to: 'a1',
          read: true,
          timestamp: now - 45 * 60 * 1000, // 45 min ago (recent, read)
        },
        {
          id: 'm3',
          from: 'a1',
          to: 'a2',
          read: false,
          timestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago (old, unread)
        },
      ];

      mockStorage.getAgents.mockResolvedValue([]);
      mockFeaturesService.getFeatures.mockResolvedValue([]);
      mockMessageService.getAllMessages.mockResolvedValue(mixedMessages);

      const result = await agentService.getHubStatus();

      expect(result.messages.totalUnread).toBe(2); // m1 and m3 are unread
      expect(result.messages.recentActivity).toBe(2); // m1 and m2 are recent
    });

    it('should handle service errors gracefully', async () => {
      mockStorage.getAgents.mockRejectedValue(new Error('Storage error'));
      mockFeaturesService.getFeatures.mockResolvedValue([]);
      mockMessageService.getAllMessages.mockResolvedValue([]);

      await expect(agentService.getHubStatus()).rejects.toThrow('Storage error');
    });
  });
});
