import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FeaturesService } from '~/features/service';
import {
  CreateFeatureInput,
  CreateTaskInput,
  DelegationStatus,
  FeaturePriority,
  FeatureStatus,
  SubtaskStatus,
  TaskStatus,
} from '~/features/types';
import { FileStorage } from '~/storage/file-storage';

describe('Features Integration Tests', () => {
  let tempDirectory: string;
  let storage: FileStorage;
  let service: FeaturesService;

  beforeEach(async () => {
    // Create temporary directory for test data
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-hub-test-'));
    storage = new FileStorage(tempDirectory);
    await storage.init();
    service = new FeaturesService(storage);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDirectory, { recursive: true, force: true });
  });

  describe('Complete Feature Workflow', () => {
    it('should handle complete feature lifecycle from creation to completion', async () => {
      // 1. Create feature
      const featureInput: CreateFeatureInput = {
        name: 'Multi-Agent Chat System',
        title: 'Implement Multi-Agent Chat System',
        description: 'Add chat-only agent support across backend, frontend, and mobile',
        priority: FeaturePriority.HIGH,
        estimatedAgents: ['backend-agent', 'frontend-agent', 'mobile-agent'],
      };

      const feature = await service.createFeature(featureInput, 'coordinator-agent');

      expect(feature.status).toBe(FeatureStatus.PLANNING);
      expect(feature.id).toBe('multi-agent-chat-system');

      // 2. Approve feature
      await service.approveFeature(feature.id);
      const approvedFeature = await service.getFeature(feature.id);

      expect(approvedFeature!.status).toBe(FeatureStatus.ACTIVE);

      // 3. Create tasks with delegations
      const taskInput: CreateTaskInput = {
        title: 'Implement chat infrastructure',
        description: 'Add chat support across all platforms',
        delegations: [
          { agent: 'backend-agent', scope: 'Add chat API endpoints and WebSocket support' },
          { agent: 'frontend-agent', scope: 'Build chat UI components and real-time messaging' },
          { agent: 'mobile-agent', scope: 'Implement mobile chat interface' },
        ],
      };

      const { delegations, task } = await service.createTask(
        feature.id,
        taskInput,
        'coordinator-agent',
      );

      expect(delegations).toHaveLength(3);
      expect(task.status).toBe(TaskStatus.PLANNING);

      // 4. Agents accept their delegations
      for (const delegation of delegations) {
        await service.acceptDelegation(feature.id, delegation.id, delegation.agent);

        const acceptedDelegation = await storage.getDelegation(feature.id, delegation.id);

        expect(acceptedDelegation!.status).toBe(DelegationStatus.ACCEPTED);
      }

      // 5. Backend agent creates subtasks
      const backendDelegation = delegations.find(d => d.agent === 'backend-agent')!;
      const backendSubtask = await service.createSubtask(
        feature.id,
        backendDelegation.id,
        {
          title: 'Create WebSocket endpoints',
          description: 'Implement real-time chat WebSocket API',
        },
        'backend-agent',
      );

      expect(backendSubtask.status).toBe(SubtaskStatus.TODO);

      // 6. Frontend agent creates subtasks
      const frontendDelegation = delegations.find(d => d.agent === 'frontend-agent')!;
      const frontendSubtask = await service.createSubtask(
        feature.id,
        frontendDelegation.id,
        {
          title: 'Build chat components',
          description: 'Create React chat UI components',
          dependsOn: [backendSubtask.id], // Depends on backend API
        },
        'frontend-agent',
      );

      // 7. Check if frontend subtask can start (should be false until backend completes)
      const canStart = await service.canStartSubtask(feature.id, frontendSubtask.id);

      expect(canStart).toBe(false);

      // 8. Backend completes their subtask
      await service.updateSubtask(
        feature.id,
        backendSubtask.id,
        {
          status: SubtaskStatus.COMPLETED,
          output: 'WebSocket API endpoints implemented at /api/chat/ws with message handling',
        },
        'backend-agent',
      );

      // 9. Now frontend can start
      const canStartNow = await service.canStartSubtask(feature.id, frontendSubtask.id);

      expect(canStartNow).toBe(true);

      // 10. Frontend starts and completes their work
      await service.updateSubtask(
        feature.id,
        frontendSubtask.id,
        {
          status: SubtaskStatus.IN_PROGRESS,
        },
        'frontend-agent',
      );

      await service.updateSubtask(
        feature.id,
        frontendSubtask.id,
        {
          status: SubtaskStatus.COMPLETED,
          output: 'Chat UI components completed with real-time messaging integration',
        },
        'frontend-agent',
      );

      // 11. Mobile agent creates and completes their subtask
      const mobileDelegation = delegations.find(d => d.agent === 'mobile-agent')!;
      const mobileSubtask = await service.createSubtask(
        feature.id,
        mobileDelegation.id,
        {
          title: 'Mobile chat interface',
          description: 'Implement mobile-specific chat UI',
        },
        'mobile-agent',
      );

      await service.updateSubtask(
        feature.id,
        mobileSubtask.id,
        {
          status: SubtaskStatus.COMPLETED,
          output: 'Mobile chat interface completed with native styling',
        },
        'mobile-agent',
      );

      // 12. Verify automatic completion cascade
      // Check delegations are completed
      const finalDelegations = await storage.getDelegations(feature.id);

      expect(finalDelegations.every(d => d.status === DelegationStatus.COMPLETED)).toBe(true);

      // Check task is completed
      const finalTask = await storage.getTask(feature.id, task.id);

      expect(finalTask!.status).toBe(TaskStatus.COMPLETED);

      // Check feature is completed
      const finalFeature = await storage.getFeature(feature.id);

      expect(finalFeature!.status).toBe(FeatureStatus.COMPLETED);

      // 13. Get complete feature data
      const featureData = await service.getFeatureData(feature.id);

      expect(featureData).toBeDefined();
      expect(featureData!.tasks).toHaveLength(1);
      expect(featureData!.delegations).toHaveLength(3);
      expect(featureData!.subtasks).toHaveLength(3);
    });
  });

  describe('Multi-Feature Agent Workload', () => {
    it('should handle agent workload across multiple features', async () => {
      // Create multiple features
      const feature1 = await service.createFeature(
        {
          name: 'Performance Optimization',
          title: 'Optimize System Performance',
          description: 'Improve system performance across all components',
          priority: FeaturePriority.CRITICAL,
        },
        'coordinator',
      );

      const feature2 = await service.createFeature(
        {
          name: 'UI Redesign',
          title: 'Redesign User Interface',
          description: 'Modern UI/UX improvements',
          priority: FeaturePriority.HIGH,
        },
        'coordinator',
      );

      const feature3 = await service.createFeature(
        {
          name: 'Bug Fixes',
          title: 'Critical Bug Fixes',
          description: 'Fix critical production bugs',
          priority: FeaturePriority.NORMAL,
        },
        'coordinator',
      );

      // Approve all features
      await service.approveFeature(feature1.id);
      await service.approveFeature(feature2.id);
      await service.approveFeature(feature3.id);

      // Create tasks in each feature with shared agent
      await service.createTask(
        feature1.id,
        {
          title: 'Database optimization',
          description: 'Optimize database queries',
          delegations: [{ agent: 'backend-agent', scope: 'Optimize slow database queries' }],
        },
        'coordinator',
      );

      await service.createTask(
        feature2.id,
        {
          title: 'API redesign',
          description: 'Redesign API endpoints',
          delegations: [
            { agent: 'backend-agent', scope: 'Redesign REST API structure' },
            { agent: 'frontend-agent', scope: 'Update frontend to use new API' },
          ],
        },
        'coordinator',
      );

      await service.createTask(
        feature3.id,
        {
          title: 'Fix authentication bugs',
          description: 'Fix critical auth issues',
          delegations: [{ agent: 'backend-agent', scope: 'Fix session management bugs' }],
        },
        'coordinator',
      );

      // Get backend agent's workload
      const workload = await service.getAgentWorkload('backend-agent');

      expect(workload.activeFeatures).toHaveLength(3);

      // Should be sorted by priority (critical, high, normal)
      expect(workload.activeFeatures[0].feature.priority).toBe(FeaturePriority.CRITICAL);
      expect(workload.activeFeatures[1].feature.priority).toBe(FeaturePriority.HIGH);
      expect(workload.activeFeatures[2].feature.priority).toBe(FeaturePriority.NORMAL);

      // Verify delegations
      expect(workload.activeFeatures[0].myDelegations).toHaveLength(1);
      expect(workload.activeFeatures[1].myDelegations).toHaveLength(1);
      expect(workload.activeFeatures[2].myDelegations).toHaveLength(1);

      // Get frontend agent's workload (should only have UI redesign)
      const frontendWorkload = await service.getAgentWorkload('frontend-agent');

      expect(frontendWorkload.activeFeatures).toHaveLength(1);
      expect(frontendWorkload.activeFeatures[0].feature.id).toBe(feature2.id);
    });
  });

  describe('Feature Statistics and Monitoring', () => {
    it('should provide comprehensive feature statistics', async () => {
      // Create features with different statuses
      const feature1 = await service.createFeature(
        {
          name: 'Active Feature',
          title: 'Active Feature',
          description: 'Test active feature',
          priority: FeaturePriority.HIGH,
        },
        'agent1',
      );

      const feature2 = await service.createFeature(
        {
          name: 'Completed Feature',
          title: 'Completed Feature',
          description: 'Test completed feature',
          priority: FeaturePriority.LOW,
        },
        'agent2',
      );

      // Approve and complete one feature
      await service.approveFeature(feature1.id);
      await storage.updateFeature(feature2.id, { status: FeatureStatus.COMPLETED });

      // Get global stats
      const globalStats = await service.getFeatureStats();

      expect(globalStats).toEqual({
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
          // No assigned agents yet since no tasks created
        },
      });

      // Create task with delegations to test agent stats
      await service.createTask(
        feature1.id,
        {
          title: 'Test Task',
          description: 'Test task with multiple agents',
          delegations: [
            { agent: 'backend-agent', scope: 'Backend work' },
            { agent: 'frontend-agent', scope: 'Frontend work' },
          ],
        },
        'coordinator',
      );

      const updatedStats = await service.getFeatureStats();

      expect(updatedStats.byAgent).toEqual({
        'backend-agent': 1,
        'frontend-agent': 1,
      });

      // Get feature-specific stats
      await service.createTask(
        feature1.id,
        {
          title: 'Another Task',
          description: 'Another test task',
          delegations: [{ agent: 'test-agent', scope: 'Test work' }],
        },
        'coordinator',
      );

      // Create subtasks
      const delegation = await storage.getDelegations(feature1.id, 'test-agent');
      const subtask = await service.createSubtask(
        feature1.id,
        delegation[0].id,
        {
          title: 'Test Subtask',
        },
        'test-agent',
      );

      // Complete subtask
      await service.updateSubtask(
        feature1.id,
        subtask.id,
        {
          status: SubtaskStatus.COMPLETED,
        },
        'test-agent',
      );

      const featureStats = await service.getFeatureStats(feature1.id);

      expect(featureStats).toMatchObject({
        feature: expect.objectContaining({ id: feature1.id }),
        tasksTotal: 2,
        tasksCompleted: 1, // One task should be completed due to subtask completion
        delegationsTotal: 3,
        delegationsCompleted: 1, // One delegation completed
        subtasksTotal: 1,
        subtasksCompleted: 1,
        agents: expect.arrayContaining(['backend-agent', 'frontend-agent', 'test-agent']),
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent subtask updates correctly', async () => {
      const feature = await service.createFeature(
        {
          name: 'Concurrent Test',
          title: 'Test Concurrent Operations',
          description: 'Test concurrent subtask operations',
          priority: FeaturePriority.NORMAL,
        },
        'coordinator',
      );

      await service.approveFeature(feature.id);

      const { delegations } = await service.createTask(
        feature.id,
        {
          title: 'Concurrent Task',
          description: 'Task with multiple subtasks',
          delegations: [{ agent: 'agent1', scope: 'Agent 1 work' }],
        },
        'coordinator',
      );

      await service.acceptDelegation(feature.id, delegations[0].id, 'agent1');

      // Create multiple subtasks
      const subtask1 = await service.createSubtask(
        feature.id,
        delegations[0].id,
        {
          title: 'Subtask 1',
        },
        'agent1',
      );

      const subtask2 = await service.createSubtask(
        feature.id,
        delegations[0].id,
        {
          title: 'Subtask 2',
        },
        'agent1',
      );

      // Complete both subtasks (sequentially to avoid race conditions)
      await service.updateSubtask(
        feature.id,
        subtask1.id,
        {
          status: SubtaskStatus.COMPLETED,
        },
        'agent1',
      );

      await service.updateSubtask(
        feature.id,
        subtask2.id,
        {
          status: SubtaskStatus.COMPLETED,
        },
        'agent1',
      );

      // Verify delegation and task are completed
      const finalDelegation = await storage.getDelegation(feature.id, delegations[0].id);

      expect(finalDelegation!.status).toBe(DelegationStatus.COMPLETED);

      const finalFeature = await storage.getFeature(feature.id);

      expect(finalFeature!.status).toBe(FeatureStatus.COMPLETED);
    });

    it('should handle blocked subtasks correctly', async () => {
      const feature = await service.createFeature(
        {
          name: 'Blocked Test',
          title: 'Test Blocked Subtasks',
          description: 'Test handling of blocked subtasks',
          priority: FeaturePriority.NORMAL,
        },
        'coordinator',
      );

      await service.approveFeature(feature.id);

      const { delegations } = await service.createTask(
        feature.id,
        {
          title: 'Blockable Task',
          description: 'Task that can be blocked',
          delegations: [{ agent: 'agent1', scope: 'Agent 1 work' }],
        },
        'coordinator',
      );

      await service.acceptDelegation(feature.id, delegations[0].id, 'agent1');

      const subtask = await service.createSubtask(
        feature.id,
        delegations[0].id,
        {
          title: 'Blockable Subtask',
        },
        'agent1',
      );

      // Block the subtask
      await service.updateSubtask(
        feature.id,
        subtask.id,
        {
          status: SubtaskStatus.BLOCKED,
          blockedReason: 'Waiting for external API approval',
        },
        'agent1',
      );

      // Verify subtask is blocked
      const blockedSubtask = await storage.getSubtask(feature.id, subtask.id);

      expect(blockedSubtask!.status).toBe(SubtaskStatus.BLOCKED);
      expect(blockedSubtask!.blockedReason).toBe('Waiting for external API approval');

      // Verify delegation is NOT completed
      const delegation = await storage.getDelegation(feature.id, delegations[0].id);

      expect(delegation!.status).not.toBe(DelegationStatus.COMPLETED);

      // Unblock and complete
      await service.updateSubtask(
        feature.id,
        subtask.id,
        {
          status: SubtaskStatus.COMPLETED,
          output: 'API approval received and implemented',
        },
        'agent1',
      );

      // Now delegation should be completed
      const completedDelegation = await storage.getDelegation(feature.id, delegations[0].id);

      expect(completedDelegation!.status).toBe(DelegationStatus.COMPLETED);
    });
  });

  describe('Feature Lifecycle Management', () => {
    it('should handle feature pause and resume', async () => {
      const feature = await service.createFeature(
        {
          name: 'Pausable Feature',
          title: 'Test Pausable Feature',
          description: 'Feature that can be paused',
          priority: FeaturePriority.NORMAL,
        },
        'coordinator',
      );

      await service.approveFeature(feature.id);

      // Pause feature
      await service.pauseFeature(feature.id);
      const pausedFeature = await storage.getFeature(feature.id);

      expect(pausedFeature!.status).toBe(FeatureStatus.ON_HOLD);

      // Resume feature
      await service.resumeFeature(feature.id);
      const resumedFeature = await storage.getFeature(feature.id);

      expect(resumedFeature!.status).toBe(FeatureStatus.ACTIVE);

      // Cancel feature
      await service.cancelFeature(feature.id);
      const cancelledFeature = await storage.getFeature(feature.id);

      expect(cancelledFeature!.status).toBe(FeatureStatus.CANCELLED);
    });
  });
});
