import { validateToolInput } from '~/validation';

import {
  AcceptDelegationInput,
  CreateFeatureInput,
  CreateSubtaskInput,
  CreateTaskInput,
  FeatureFilters,
  FeaturePriority,
  GetFeatureInput,
  GetFeaturesInput,
  StorageAdapter,
  UpdateSubtaskInput,
} from '~/types';

import { FeaturesService } from './service';

export class FeaturesHandler {
  private service: FeaturesService;

  constructor(storage: StorageAdapter) {
    this.service = new FeaturesService(storage);
  }

  async handleFeatureTool(name: string, arguments_: unknown): Promise<any> {
    switch (name) {
      case 'create_feature':
        return this.createFeature(validateToolInput('create_feature', arguments_));
      case 'create_task':
        return this.createTask(validateToolInput('create_task', arguments_));
      case 'create_subtask':
        return this.createSubtask(validateToolInput('create_subtask', arguments_));
      case 'get_features':
        return this.getFeatures(validateToolInput('get_features', arguments_));
      case 'get_feature':
        return this.getFeature(validateToolInput('get_feature', arguments_));
      case 'accept_delegation':
        return this.acceptDelegation(validateToolInput('accept_delegation', arguments_));
      case 'update_subtask':
        return this.updateSubtask(validateToolInput('update_subtask', arguments_));
      default:
        throw new Error(`Unknown feature tool: ${name}`);
    }
  }

  private async createFeature(arguments_: CreateFeatureInput): Promise<any> {
    try {
      const feature = await this.service.createFeature(
        {
          ...arguments_,
          priority: arguments_.priority ?? FeaturePriority.NORMAL,
          estimatedAgents: arguments_.estimatedAgents || [],
        },
        arguments_.createdBy,
      );

      return {
        success: true,
        feature,
        message: `Feature "${feature.title}" created successfully with ID: ${feature.id}`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async createTask(arguments_: CreateTaskInput): Promise<any> {
    try {
      const result = await this.service.createTask(
        arguments_.featureId,
        arguments_,
        arguments_.createdBy,
      );

      return {
        success: true,
        task: result.task,
        delegations: result.delegations,
        message: `Task "${result.task.title}" created with ${result.delegations.length} delegations`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async createSubtask(arguments_: CreateSubtaskInput): Promise<any> {
    try {
      const subtasks = [];

      for (const subtaskData of arguments_.subtasks) {
        const subtask = await this.service.createSubtask(
          arguments_.featureId,
          arguments_.delegationId,
          subtaskData,
          arguments_.createdBy,
        );

        subtasks.push(subtask);
      }

      return {
        success: true,
        subtasks,
        message: `Created ${subtasks.length} subtask(s) for delegation ${arguments_.delegationId}`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getFeatures(arguments_: GetFeaturesInput): Promise<any> {
    try {
      const filters: FeatureFilters = {
        status: arguments_.status as any,
        priority: arguments_.priority,
        agent: arguments_.agent,
        createdBy: arguments_.createdBy,
      };

      // Remove undefined properties
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof FeatureFilters] === undefined) {
          delete filters[key as keyof FeatureFilters];
        }
      });

      const features = await this.service.getFeatures(
        Object.keys(filters).length > 0 ? filters : undefined,
      );

      return {
        success: true,
        features,
        count: features.length,
        summary: {
          byStatus: features.reduce(
            (acc, f) => {
              acc[f.status] = (acc[f.status] || 0) + 1;

              return acc;
            },
            {} as Record<string, number>,
          ),
          byPriority: features.reduce(
            (acc, f) => {
              acc[f.priority] = (acc[f.priority] || 0) + 1;

              return acc;
            },
            {} as Record<string, number>,
          ),
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getFeature(arguments_: GetFeatureInput): Promise<any> {
    try {
      const featureData = await this.service.getFeatureData(arguments_.featureId);

      if (!featureData) {
        return {
          success: false,
          error: `Feature not found: ${arguments_.featureId}`,
        };
      }

      return {
        success: true,
        ...featureData,
        summary: {
          tasksTotal: featureData.tasks.length,
          tasksCompleted: featureData.tasks.filter(t => t.status === 'completed').length,
          delegationsTotal: featureData.delegations.length,
          delegationsCompleted: featureData.delegations.filter(d => d.status === 'completed')
            .length,
          subtasksTotal: featureData.subtasks.length,
          subtasksCompleted: featureData.subtasks.filter(s => s.status === 'completed').length,
          uniqueAgents: [...new Set(featureData.delegations.map(d => d.agent))],
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async acceptDelegation(arguments_: AcceptDelegationInput): Promise<any> {
    try {
      await this.service.acceptDelegation(
        arguments_.featureId,
        arguments_.delegationId,
        arguments_.agentId,
      );

      return {
        success: true,
        message: `Delegation ${arguments_.delegationId} accepted by agent ${arguments_.agentId}`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async updateSubtask(arguments_: UpdateSubtaskInput): Promise<any> {
    try {
      const updates = {
        status: arguments_.status,
        output: arguments_.output,
        blockedReason: arguments_.blockedReason,
      };

      // Remove undefined properties
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof typeof updates] === undefined) {
          delete updates[key as keyof typeof updates];
        }
      });

      await this.service.updateSubtask(
        arguments_.featureId,
        arguments_.subtaskId,
        updates as any,
        arguments_.updatedBy,
      );

      return {
        success: true,
        message: `Subtask ${arguments_.subtaskId} updated successfully`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Utility methods for common operations

  async getFeatureStats(): Promise<any> {
    try {
      const stats = await this.service.getFeatureStats();

      return {
        success: true,
        stats,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async approveFeature(featureId: string): Promise<any> {
    try {
      await this.service.approveFeature(featureId);

      return {
        success: true,
        message: `Feature ${featureId} approved and activated`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
