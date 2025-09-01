import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeaturesService } from '~/features/service';
import {
  CreateFeatureInput,
  CreateSubtaskInput,
  CreateTaskInput,
  Delegation,
  DelegationStatus,
  Feature,
  FeaturePriority,
  FeatureStatus,
  ParentTask,
  Subtask,
  SubtaskStatus,
  TaskStatus,
  UpdateSubtaskInput,
} from '~/features/types';

describe('FeaturesService', () => {
  let mockStorage: any;
  let service: FeaturesService;

  beforeEach(() => {
    // Create comprehensive mock storage
    mockStorage = {
      // Existing methods
      init: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      getAgents: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn().mockResolvedValue(undefined),
      getMessages: vi.fn().mockResolvedValue([]),
      getTasks: vi.fn().mockResolvedValue([]),
      markMessageAsRead: vi.fn().mockResolvedValue(undefined),
      saveAgent: vi.fn().mockResolvedValue(undefined),
      saveAllAgents: vi.fn().mockResolvedValue(undefined),
      saveMessage: vi.fn().mockResolvedValue(undefined),
      saveTask: vi.fn().mockResolvedValue(undefined),
      updateAgent: vi.fn().mockResolvedValue(undefined),

      // Features methods
      createFeature: vi.fn().mockResolvedValue(undefined),
      getFeatures: vi.fn().mockResolvedValue([]),
      getFeature: vi.fn().mockResolvedValue(undefined),
      updateFeature: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn().mockResolvedValue(undefined),
      getTasksInFeature: vi.fn().mockResolvedValue([]),
      getTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      createDelegation: vi.fn().mockResolvedValue(undefined),
      getDelegations: vi.fn().mockResolvedValue([]),
      getDelegation: vi.fn().mockResolvedValue(undefined),
      updateDelegation: vi.fn().mockResolvedValue(undefined),
      createSubtask: vi.fn().mockResolvedValue(undefined),
      getSubtasks: vi.fn().mockResolvedValue([]),
      getSubtask: vi.fn().mockResolvedValue(undefined),
      updateSubtask: vi.fn().mockResolvedValue(undefined),
      getAgentWorkload: vi.fn().mockResolvedValue({ activeFeatures: [] }),
      getFeatureData: vi.fn().mockResolvedValue(undefined),
    };

    service = new FeaturesService(mockStorage);
  });

  describe('createFeature', () => {
    it('should create a feature with valid input', async () => {
      const input: CreateFeatureInput = {
        name: 'Test Feature',
        title: 'Test Feature Title',
        description: 'Test feature description',
        priority: FeaturePriority.HIGH,
        estimatedAgents: ['agent1', 'agent2'],
      };

      const result = await service.createFeature(input, 'creator-agent');

      expect(result).toMatchObject({
        id: 'test-feature',
        name: 'test-feature',
        title: 'Test Feature Title',
        description: 'Test feature description',
        status: FeatureStatus.PLANNING,
        createdBy: 'creator-agent',
        priority: FeaturePriority.HIGH,
        estimatedAgents: ['agent1', 'agent2'],
        assignedAgents: [],
      });

      expect(mockStorage.createFeature).toHaveBeenCalledWith(result);
    });

    it('should convert feature name to kebab-case', async () => {
      const input: CreateFeatureInput = {
        name: 'Complex Feature Name With Spaces',
        title: 'Test Title',
        description: 'Test description',
        priority: FeaturePriority.NORMAL,
      };

      const result = await service.createFeature(input, 'creator');

      expect(result.id).toBe('complex-feature-name-with-spaces');
      expect(result.name).toBe('complex-feature-name-with-spaces');
    });
  });

  describe('createTask', () => {
    const mockFeature: Feature = {
      id: 'test-feature',
      name: 'test-feature',
      title: 'Test Feature',
      description: 'Test description',
      status: FeatureStatus.ACTIVE,
      createdBy: 'creator',
      priority: FeaturePriority.HIGH,
      assignedAgents: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    beforeEach(() => {
      mockStorage.getFeature.mockResolvedValue(mockFeature);
    });

    it('should create a task with delegations', async () => {
      const input: CreateTaskInput = {
        title: 'Test Task',
        description: 'Task description',
        delegations: [
          { agent: 'agent1', scope: 'Backend work' },
          { agent: 'agent2', scope: 'Frontend work' },
        ],
      };

      const result = await service.createTask('test-feature', input, 'creator');

      expect(result.task).toMatchObject({
        title: 'Test Task',
        description: 'Task description',
        status: TaskStatus.PLANNING,
        createdBy: 'creator',
      });

      expect(result.delegations).toHaveLength(2);
      expect(result.delegations[0]).toMatchObject({
        agent: 'agent1',
        scope: 'Backend work',
        status: DelegationStatus.PENDING,
        subtaskIds: [],
      });

      expect(mockStorage.createTask).toHaveBeenCalled();
      expect(mockStorage.createDelegation).toHaveBeenCalledTimes(2);
      expect(mockStorage.updateFeature).toHaveBeenCalledWith('test-feature', {
        assignedAgents: ['agent1', 'agent2'],
        updatedAt: expect.any(Number),
      });
    });

    it('should throw error if feature not found', async () => {
      mockStorage.getFeature.mockResolvedValue(undefined);

      const input: CreateTaskInput = {
        title: 'Test Task',
        description: 'Task description',
        delegations: [{ agent: 'agent1', scope: 'Work' }],
      };

      await expect(service.createTask('nonexistent', input, 'creator')).rejects.toThrow(
        'Feature not found: nonexistent',
      );
    });
  });

  describe('acceptDelegation', () => {
    const mockDelegation: Delegation = {
      id: 'del-1',
      parentTaskId: 'task-1',
      agent: 'agent1',
      scope: 'Test work',
      status: DelegationStatus.PENDING,
      subtaskIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should accept a pending delegation', async () => {
      mockStorage.getDelegation.mockResolvedValue(mockDelegation);

      await service.acceptDelegation('feature-1', 'del-1', 'agent1');

      expect(mockStorage.updateDelegation).toHaveBeenCalledWith('feature-1', 'del-1', {
        status: DelegationStatus.ACCEPTED,
        acceptedAt: expect.any(Number),
      });
    });

    it('should throw error if delegation not found', async () => {
      mockStorage.getDelegation.mockResolvedValue(undefined);

      await expect(service.acceptDelegation('feature-1', 'del-1', 'agent1')).rejects.toThrow(
        'Delegation not found: del-1 in feature feature-1',
      );
    });

    it('should throw error if wrong agent tries to accept', async () => {
      mockStorage.getDelegation.mockResolvedValue(mockDelegation);

      await expect(service.acceptDelegation('feature-1', 'del-1', 'wrong-agent')).rejects.toThrow(
        'Delegation del-1 is not assigned to agent wrong-agent',
      );
    });

    it('should throw error if delegation already accepted', async () => {
      const acceptedDelegation = { ...mockDelegation, status: DelegationStatus.ACCEPTED };

      mockStorage.getDelegation.mockResolvedValue(acceptedDelegation);

      await expect(service.acceptDelegation('feature-1', 'del-1', 'agent1')).rejects.toThrow(
        'Delegation del-1 has already been accepted',
      );
    });
  });

  describe('createSubtask', () => {
    const mockDelegation: Delegation = {
      id: 'del-1',
      parentTaskId: 'task-1',
      agent: 'agent1',
      scope: 'Test work',
      status: DelegationStatus.ACCEPTED,
      subtaskIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    beforeEach(() => {
      mockStorage.getDelegation.mockResolvedValue(mockDelegation);
    });

    it('should create a subtask for accepted delegation', async () => {
      const input: CreateSubtaskInput = {
        title: 'Test Subtask',
        description: 'Subtask description',
        dependsOn: ['other-subtask-id'],
      };

      const result = await service.createSubtask('feature-1', 'del-1', input, 'agent1');

      expect(result).toMatchObject({
        title: 'Test Subtask',
        description: 'Subtask description',
        delegationId: 'del-1',
        parentTaskId: 'task-1',
        status: SubtaskStatus.TODO,
        createdBy: 'agent1',
        dependsOn: ['other-subtask-id'],
      });

      expect(mockStorage.createSubtask).toHaveBeenCalled();
      expect(mockStorage.updateDelegation).toHaveBeenCalledWith('feature-1', 'del-1', {
        subtaskIds: [result.id],
      });
    });

    it('should update delegation status to in-progress', async () => {
      const pendingDelegation = { ...mockDelegation, status: DelegationStatus.PENDING };

      mockStorage.getDelegation.mockResolvedValue(pendingDelegation);

      const input: CreateSubtaskInput = {
        title: 'Test Subtask',
      };

      await service.createSubtask('feature-1', 'del-1', input, 'agent1');

      expect(mockStorage.updateDelegation).toHaveBeenCalledWith('feature-1', 'del-1', {
        status: DelegationStatus.IN_PROGRESS,
      });
    });

    it('should throw error if wrong agent creates subtask', async () => {
      const input: CreateSubtaskInput = {
        title: 'Test Subtask',
      };

      await expect(
        service.createSubtask('feature-1', 'del-1', input, 'wrong-agent'),
      ).rejects.toThrow('Only assigned agent agent1 can create subtasks for delegation del-1');
    });
  });

  describe('updateSubtask', () => {
    const mockSubtask: Subtask = {
      id: 'sub-1',
      delegationId: 'del-1',
      parentTaskId: 'task-1',
      title: 'Test Subtask',
      status: SubtaskStatus.IN_PROGRESS,
      createdBy: 'agent1',
      dependsOn: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    beforeEach(() => {
      mockStorage.getSubtask.mockResolvedValue(mockSubtask);
    });

    it('should update subtask with valid input', async () => {
      const updates: UpdateSubtaskInput = {
        status: SubtaskStatus.COMPLETED,
        output: 'Task completed successfully',
      };

      await service.updateSubtask('feature-1', 'sub-1', updates, 'agent1');

      expect(mockStorage.updateSubtask).toHaveBeenCalledWith('feature-1', 'sub-1', {
        ...updates,
        updatedAt: expect.any(Number),
      });
    });

    it('should throw error if wrong agent updates subtask', async () => {
      const updates: UpdateSubtaskInput = {
        status: SubtaskStatus.COMPLETED,
      };

      await expect(
        service.updateSubtask('feature-1', 'sub-1', updates, 'wrong-agent'),
      ).rejects.toThrow('Only the creator agent1 can update subtask sub-1');
    });

    it('should check delegation completion when subtask completed', async () => {
      const updates: UpdateSubtaskInput = {
        status: SubtaskStatus.COMPLETED,
      };

      // Mock delegation check
      const mockDelegation: Delegation = {
        id: 'del-1',
        parentTaskId: 'task-1',
        agent: 'agent1',
        scope: 'Test work',
        status: DelegationStatus.IN_PROGRESS,
        subtaskIds: ['sub-1'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockStorage.getDelegation.mockResolvedValue(mockDelegation);
      mockStorage.getSubtasks.mockResolvedValue([
        { ...mockSubtask, status: SubtaskStatus.COMPLETED },
      ]);

      await service.updateSubtask('feature-1', 'sub-1', updates, 'agent1');

      // Should mark delegation as completed
      expect(mockStorage.updateDelegation).toHaveBeenCalledWith('feature-1', 'del-1', {
        status: DelegationStatus.COMPLETED,
        completedAt: expect.any(Number),
      });
    });
  });

  describe('getAgentWorkload', () => {
    it('should delegate to storage adapter', async () => {
      const mockWorkload = {
        activeFeatures: [
          {
            featureId: 'feature-1',
            feature: {
              id: 'feature-1',
              title: 'Test Feature',
              priority: FeaturePriority.HIGH,
            } as Feature,
            myDelegations: [] as Delegation[],
          },
        ],
      };

      mockStorage.getAgentWorkload.mockResolvedValue(mockWorkload);

      const result = await service.getAgentWorkload('agent1');

      expect(result).toEqual(mockWorkload);
      expect(mockStorage.getAgentWorkload).toHaveBeenCalledWith('agent1');
    });
  });

  describe('getFeatureStats', () => {
    it('should return global stats when no feature ID provided', async () => {
      const mockFeatures: Feature[] = [
        {
          id: 'f1',
          name: 'f1',
          title: 'Feature 1',
          description: 'Desc 1',
          status: FeatureStatus.ACTIVE,
          priority: FeaturePriority.HIGH,
          createdBy: 'agent1',
          assignedAgents: ['agent1', 'agent2'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'f2',
          name: 'f2',
          title: 'Feature 2',
          description: 'Desc 2',
          status: FeatureStatus.COMPLETED,
          priority: FeaturePriority.LOW,
          createdBy: 'agent2',
          assignedAgents: ['agent1'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockStorage.getFeatures.mockResolvedValue(mockFeatures);

      const result = await service.getFeatureStats();

      expect(result).toEqual({
        active: 1,
        completed: 1,
        planning: 0,
        onHold: 0,
        cancelled: 0,
        byPriority: {
          high: 1,
          low: 1,
        },
        byAgent: {
          agent1: 2,
          agent2: 1,
        },
      });
    });

    it('should return feature-specific stats when feature ID provided', async () => {
      const mockFeatureData = {
        feature: {
          id: 'f1',
          title: 'Feature 1',
          status: FeatureStatus.ACTIVE,
        } as Feature,
        tasks: [
          { id: 't1', status: TaskStatus.COMPLETED } as ParentTask,
          { id: 't2', status: TaskStatus.IN_PROGRESS } as ParentTask,
        ],
        delegations: [
          { id: 'd1', agent: 'agent1', status: DelegationStatus.COMPLETED } as Delegation,
          { id: 'd2', agent: 'agent2', status: DelegationStatus.IN_PROGRESS } as Delegation,
        ],
        subtasks: [
          { id: 's1', status: SubtaskStatus.COMPLETED } as Subtask,
          { id: 's2', status: SubtaskStatus.TODO } as Subtask,
          { id: 's3', status: SubtaskStatus.COMPLETED } as Subtask,
        ],
      };

      mockStorage.getFeatureData.mockResolvedValue(mockFeatureData);

      const result = await service.getFeatureStats('f1');

      expect(result).toEqual({
        feature: mockFeatureData.feature,
        tasksTotal: 2,
        tasksCompleted: 1,
        delegationsTotal: 2,
        delegationsCompleted: 1,
        subtasksTotal: 3,
        subtasksCompleted: 2,
        agents: ['agent1', 'agent2'],
      });
    });
  });

  describe('utility methods', () => {
    it('should approve feature', async () => {
      await service.approveFeature('feature-1');

      expect(mockStorage.updateFeature).toHaveBeenCalledWith('feature-1', {
        status: FeatureStatus.ACTIVE,
        updatedAt: expect.any(Number),
      });
    });

    it('should pause feature', async () => {
      await service.pauseFeature('feature-1');

      expect(mockStorage.updateFeature).toHaveBeenCalledWith('feature-1', {
        status: FeatureStatus.ON_HOLD,
        updatedAt: expect.any(Number),
      });
    });

    it('should cancel feature', async () => {
      await service.cancelFeature('feature-1');

      expect(mockStorage.updateFeature).toHaveBeenCalledWith('feature-1', {
        status: FeatureStatus.CANCELLED,
        updatedAt: expect.any(Number),
      });
    });
  });

  describe('dependency management', () => {
    const mockSubtask: Subtask = {
      id: 'sub-1',
      delegationId: 'del-1',
      parentTaskId: 'task-1',
      title: 'Test Subtask',
      status: SubtaskStatus.TODO,
      createdBy: 'agent1',
      dependsOn: ['sub-2', 'sub-3'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    beforeEach(() => {
      mockStorage.getSubtask.mockResolvedValue(mockSubtask);
    });

    it('should get subtask dependencies', async () => {
      const mockDep1: Subtask = {
        ...mockSubtask,
        id: 'sub-2',
        status: SubtaskStatus.COMPLETED,
        dependsOn: [],
      };
      const mockDep2: Subtask = {
        ...mockSubtask,
        id: 'sub-3',
        status: SubtaskStatus.IN_PROGRESS,
        dependsOn: [],
      };

      mockStorage.getSubtask
        .mockResolvedValueOnce(mockSubtask) // First call for the main subtask
        .mockResolvedValueOnce(mockDep1) // Second call for sub-2
        .mockResolvedValueOnce(mockDep2); // Third call for sub-3

      const result = await service.getSubtaskDependencies('feature-1', 'sub-1');

      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['sub-2', 'sub-3']);
    });

    it('should check if subtask can start when all dependencies completed', async () => {
      const mockDep1: Subtask = {
        ...mockSubtask,
        id: 'sub-2',
        status: SubtaskStatus.COMPLETED,
        dependsOn: [],
      };
      const mockDep2: Subtask = {
        ...mockSubtask,
        id: 'sub-3',
        status: SubtaskStatus.COMPLETED,
        dependsOn: [],
      };

      mockStorage.getSubtask
        .mockResolvedValueOnce(mockSubtask) // First call for the main subtask
        .mockResolvedValueOnce(mockDep1) // Second call for sub-2
        .mockResolvedValueOnce(mockDep2); // Third call for sub-3

      const result = await service.canStartSubtask('feature-1', 'sub-1');

      expect(result).toBe(true);
    });

    it('should check if subtask cannot start when dependencies incomplete', async () => {
      const mockDep1: Subtask = {
        ...mockSubtask,
        id: 'sub-2',
        status: SubtaskStatus.COMPLETED,
        dependsOn: [],
      };
      const mockDep2: Subtask = {
        ...mockSubtask,
        id: 'sub-3',
        status: SubtaskStatus.IN_PROGRESS,
        dependsOn: [],
      };

      mockStorage.getSubtask
        .mockResolvedValueOnce(mockSubtask) // First call for the main subtask
        .mockResolvedValueOnce(mockDep1) // Second call for sub-2
        .mockResolvedValueOnce(mockDep2); // Third call for sub-3

      const result = await service.canStartSubtask('feature-1', 'sub-1');

      expect(result).toBe(false);
    });
  });
});
