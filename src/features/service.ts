import { createId } from '@paralleldrive/cuid2';

import type { StorageAdapter } from '~/storage/types';

import {
  AgentWorkload,
  CreateFeatureInput,
  CreateSubtaskInput,
  CreateTaskInput,
  Delegation,
  DelegationStatus,
  Feature,
  FeatureData,
  FeatureFilters,
  FeatureStatus,
  ParentTask,
  Subtask,
  SubtaskStatus,
  TaskStatus,
  UpdateSubtaskInput,
} from './types';

export class FeaturesService {
  constructor(private storage: StorageAdapter) {}

  async createFeature(input: CreateFeatureInput, createdBy: string): Promise<Feature> {
    const now = Date.now();

    const feature: Feature = {
      id: input.name.toLowerCase().replace(/[^\da-z]+/g, '-'),
      name: input.name.toLowerCase().replace(/[^\da-z]+/g, '-'),
      title: input.title,
      description: input.description,
      status: FeatureStatus.PLANNING,
      createdBy,
      priority: input.priority,
      estimatedAgents: input.estimatedAgents,
      assignedAgents: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.createFeature(feature);

    return feature;
  }

  async getFeatures(filters?: FeatureFilters): Promise<Feature[]> {
    return this.storage.getFeatures(filters);
  }

  async getFeature(featureId: string): Promise<Feature | undefined> {
    return this.storage.getFeature(featureId);
  }

  async updateFeature(featureId: string, updates: Partial<Feature>): Promise<void> {
    await this.storage.updateFeature(featureId, { ...updates, updatedAt: Date.now() });
  }

  async approveFeature(featureId: string): Promise<void> {
    await this.updateFeature(featureId, { status: FeatureStatus.ACTIVE });
  }

  async createTask(
    featureId: string,
    input: CreateTaskInput,
    createdBy: string,
  ): Promise<{ delegations: Delegation[]; task: ParentTask }> {
    const feature = await this.storage.getFeature(featureId);

    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`);
    }

    const now = Date.now();
    const taskId = createId();

    const task: ParentTask = {
      id: taskId,
      title: input.title,
      description: input.description,
      status: TaskStatus.PLANNING,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    // Create delegations for this task
    const delegations: Delegation[] = input.delegations.map((del, index) => ({
      id: `${taskId}-del-${index + 1}`,
      parentTaskId: taskId,
      agent: del.agent,
      scope: del.scope,
      status: DelegationStatus.PENDING,
      subtaskIds: [],
      createdAt: now,
      updatedAt: now,
    }));

    // Save task and delegations
    await this.storage.createTask(featureId, task);

    for (const delegation of delegations) {
      await this.storage.createDelegation(featureId, delegation);
    }

    // Update feature's assigned agents
    const allAgents = [...(feature.assignedAgents || []), ...delegations.map(d => d.agent)];
    const uniqueAgents = [...new Set(allAgents)];

    await this.updateFeature(featureId, { assignedAgents: uniqueAgents });

    return { task, delegations };
  }

  async acceptDelegation(featureId: string, delegationId: string, agentId: string): Promise<void> {
    const delegation = await this.storage.getDelegation(featureId, delegationId);

    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId} in feature ${featureId}`);
    }

    if (delegation.agent !== agentId) {
      throw new Error(`Delegation ${delegationId} is not assigned to agent ${agentId}`);
    }

    if (delegation.status !== DelegationStatus.PENDING) {
      throw new Error(`Delegation ${delegationId} has already been ${delegation.status}`);
    }

    await this.storage.updateDelegation(featureId, delegationId, {
      status: DelegationStatus.ACCEPTED,
      acceptedAt: Date.now(),
    });
  }

  async createSubtask(
    featureId: string,
    delegationId: string,
    input: CreateSubtaskInput,
    createdBy: string,
  ): Promise<Subtask> {
    const delegation = await this.storage.getDelegation(featureId, delegationId);

    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId} in feature ${featureId}`);
    }

    if (delegation.agent !== createdBy) {
      throw new Error(
        `Only assigned agent ${delegation.agent} can create subtasks for delegation ${delegationId}`,
      );
    }

    const now = Date.now();
    const subtaskId = createId();

    const subtask: Subtask = {
      id: subtaskId,
      delegationId,
      parentTaskId: delegation.parentTaskId,
      title: input.title,
      description: input.description,
      status: SubtaskStatus.TODO,
      createdBy,
      dependsOn: input.dependsOn || [],
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.createSubtask(featureId, subtask);

    // Update delegation to include this subtask
    const updatedSubtaskIds = [...delegation.subtaskIds, subtaskId];

    await this.storage.updateDelegation(featureId, delegationId, {
      subtaskIds: updatedSubtaskIds,
    });

    // If delegation was pending and now has subtasks, mark as in-progress
    if (
      delegation.status === DelegationStatus.ACCEPTED ||
      delegation.status === DelegationStatus.PENDING
    ) {
      await this.storage.updateDelegation(featureId, delegationId, {
        status: DelegationStatus.IN_PROGRESS,
      });
    }

    return subtask;
  }

  async updateSubtask(
    featureId: string,
    subtaskId: string,
    updates: UpdateSubtaskInput,
    updatedBy: string,
  ): Promise<void> {
    const subtask = await this.storage.getSubtask(featureId, subtaskId);

    if (!subtask) {
      throw new Error(`Subtask not found: ${subtaskId} in feature ${featureId}`);
    }

    if (subtask.createdBy !== updatedBy) {
      throw new Error(`Only the creator ${subtask.createdBy} can update subtask ${subtaskId}`);
    }

    await this.storage.updateSubtask(featureId, subtaskId, {
      ...updates,
      updatedAt: Date.now(),
    });

    // Check if delegation should be marked as completed
    if (updates.status === SubtaskStatus.COMPLETED) {
      await this.checkDelegationCompletion(featureId, subtask.delegationId);
    }
  }

  private async checkDelegationCompletion(featureId: string, delegationId: string): Promise<void> {
    const delegation = await this.storage.getDelegation(featureId, delegationId);

    if (!delegation) {
      return;
    }

    const subtasks = await this.storage.getSubtasks(featureId, delegationId);
    const allCompleted =
      subtasks.length > 0 && subtasks.every(s => s.status === SubtaskStatus.COMPLETED);

    if (allCompleted && delegation.status !== DelegationStatus.COMPLETED) {
      await this.storage.updateDelegation(featureId, delegationId, {
        status: DelegationStatus.COMPLETED,
        completedAt: Date.now(),
      });

      // Check if parent task should be marked as completed
      await this.checkTaskCompletion(featureId, delegation.parentTaskId);
    }
  }

  private async checkTaskCompletion(featureId: string, taskId: string): Promise<void> {
    const task = await this.storage.getTask(featureId, taskId);

    if (!task) {
      return;
    }

    const delegations = await this.storage.getDelegations(featureId);
    const taskDelegations = delegations.filter(d => d.parentTaskId === taskId);
    const allCompleted =
      taskDelegations.length > 0 &&
      taskDelegations.every(d => d.status === DelegationStatus.COMPLETED);

    if (allCompleted && task.status !== TaskStatus.COMPLETED) {
      await this.storage.updateTask(featureId, taskId, {
        status: TaskStatus.COMPLETED,
      });

      // Check if feature should be marked as completed
      await this.checkFeatureCompletion(featureId);
    }
  }

  private async checkFeatureCompletion(featureId: string): Promise<void> {
    const tasks = await this.storage.getTasksInFeature(featureId);
    const allCompleted = tasks.length > 0 && tasks.every(t => t.status === TaskStatus.COMPLETED);

    if (allCompleted) {
      await this.updateFeature(featureId, { status: FeatureStatus.COMPLETED });
    }
  }

  async getAgentWorkload(agentId: string): Promise<AgentWorkload> {
    return this.storage.getAgentWorkload(agentId);
  }

  async getFeatureData(featureId: string): Promise<FeatureData | undefined> {
    return this.storage.getFeatureData(featureId);
  }

  async getFeatureOverview(featureId?: string): Promise<Feature[] | FeatureData> {
    if (featureId) {
      const data = await this.getFeatureData(featureId);

      if (!data) {
        throw new Error(`Feature not found: ${featureId}`);
      }

      return data;
    }

    return this.getFeatures();
  }

  // Utility methods for common queries

  async getActiveFeatures(): Promise<Feature[]> {
    return this.getFeatures({ status: FeatureStatus.ACTIVE });
  }

  async getAgentFeatures(agentId: string): Promise<Feature[]> {
    return this.getFeatures({ agent: agentId });
  }

  async getFeaturesByPriority(priority: string): Promise<Feature[]> {
    return this.getFeatures({ priority: priority as any });
  }

  async getAgentDelegations(agentId: string, featureId: string): Promise<Delegation[]> {
    return this.storage.getDelegations(featureId, agentId);
  }

  async getAgentSubtasks(agentId: string, featureId: string): Promise<Subtask[]> {
    const subtasks = await this.storage.getSubtasks(featureId);

    return subtasks.filter(s => s.createdBy === agentId);
  }

  // Feature lifecycle management

  async pauseFeature(featureId: string): Promise<void> {
    await this.updateFeature(featureId, { status: FeatureStatus.ON_HOLD });
  }

  async resumeFeature(featureId: string): Promise<void> {
    await this.updateFeature(featureId, { status: FeatureStatus.ACTIVE });
  }

  async cancelFeature(featureId: string): Promise<void> {
    await this.updateFeature(featureId, { status: FeatureStatus.CANCELLED });
  }

  // Dependency management

  async getSubtaskDependencies(featureId: string, subtaskId: string): Promise<Subtask[]> {
    const subtask = await this.storage.getSubtask(featureId, subtaskId);

    if (!subtask || !subtask.dependsOn.length) {
      return [];
    }

    const dependencies: Subtask[] = [];

    for (const depId of subtask.dependsOn) {
      const dep = await this.storage.getSubtask(featureId, depId);

      if (dep) {
        dependencies.push(dep);
      }
    }

    return dependencies;
  }

  async canStartSubtask(featureId: string, subtaskId: string): Promise<boolean> {
    const dependencies = await this.getSubtaskDependencies(featureId, subtaskId);

    return dependencies.every(dep => dep.status === SubtaskStatus.COMPLETED);
  }

  // Statistics and monitoring

  async getFeatureStats(featureId?: string): Promise<any> {
    if (featureId) {
      const data = await this.getFeatureData(featureId);

      if (!data) {
        return null;
      }

      return {
        feature: data.feature,
        tasksTotal: data.tasks.length,
        tasksCompleted: data.tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        delegationsTotal: data.delegations.length,
        delegationsCompleted: data.delegations.filter(d => d.status === DelegationStatus.COMPLETED)
          .length,
        subtasksTotal: data.subtasks.length,
        subtasksCompleted: data.subtasks.filter(s => s.status === SubtaskStatus.COMPLETED).length,
        agents: [...new Set(data.delegations.map(d => d.agent))],
      };
    }

    // Global stats
    const features = await this.getFeatures();
    const stats = {
      active: features.filter(f => f.status === FeatureStatus.ACTIVE).length,
      completed: features.filter(f => f.status === FeatureStatus.COMPLETED).length,
      planning: features.filter(f => f.status === FeatureStatus.PLANNING).length,
      onHold: features.filter(f => f.status === FeatureStatus.ON_HOLD).length,
      cancelled: features.filter(f => f.status === FeatureStatus.CANCELLED).length,
      byPriority: {} as Record<string, number>,
      byAgent: {} as Record<string, number>,
    };

    // Count by priority
    for (const feature of features) {
      stats.byPriority[feature.priority] = (stats.byPriority[feature.priority] || 0) + 1;

      // Count by assigned agents
      for (const agent of feature.assignedAgents || []) {
        stats.byAgent[agent] = (stats.byAgent[agent] || 0) + 1;
      }
    }

    return stats;
  }
}
