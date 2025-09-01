import type { StorageAdapter } from '~/storage/types';
import { validateToolInput } from '~/validation';

import { FeaturesService } from './service';
import {
  CreateFeatureInput,
  CreateSubtaskInput,
  CreateTaskInput,
  FeatureFilters,
  UpdateSubtaskInput,
} from './types';

export class FeaturesHandler {
  private service: FeaturesService;

  constructor(storage: StorageAdapter) {
    this.service = new FeaturesService(storage);
  }

  async handleFeatureTool(name: string, arguments_: any): Promise<any> {
    const validatedArguments = validateToolInput(name, arguments_);

    switch (name) {
      case 'create_feature':
        return this.createFeature(validatedArguments);
      case 'create_task':
        return this.createTask(validatedArguments);
      case 'create_subtask':
        return this.createSubtask(validatedArguments);
      case 'get_agent_workload':
        return this.getAgentWorkload(validatedArguments);
      case 'get_features':
        return this.getFeatures(validatedArguments);
      case 'get_feature':
        return this.getFeature(validatedArguments);
      case 'accept_delegation':
        return this.acceptDelegation(validatedArguments);
      case 'update_subtask':
        return this.updateSubtask(validatedArguments);
      default:
        throw new Error(`Unknown feature tool: ${name}`);
    }
  }

  private async createFeature(arguments_: any): Promise<any> {
    try {
      const input: CreateFeatureInput = {
        name: arguments_.name,
        title: arguments_.title,
        description: arguments_.description,
        priority: arguments_.priority,
        estimatedAgents: arguments_.estimatedAgents || [],
      };

      const feature = await this.service.createFeature(input, arguments_.createdBy);

      return {
        success: true,
        feature,
        message: `Feature "${feature.title}" created successfully with ID: ${feature.id}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async createTask(arguments_: any): Promise<any> {
    try {
      const input: CreateTaskInput = {
        title: arguments_.title,
        description: arguments_.description,
        delegations: arguments_.delegations,
      };

      const result = await this.service.createTask(
        arguments_.featureId,
        input,
        arguments_.createdBy,
      );

      return {
        success: true,
        task: result.task,
        delegations: result.delegations,
        message: `Task "${result.task.title}" created with ${result.delegations.length} delegations`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async createSubtask(arguments_: any): Promise<any> {
    try {
      const subtasks = [];

      for (const subtaskInput of arguments_.subtasks) {
        const input: CreateSubtaskInput = {
          title: subtaskInput.title,
          description: subtaskInput.description,
          dependsOn: subtaskInput.dependsOn || [],
        };

        const subtask = await this.service.createSubtask(
          arguments_.featureId,
          arguments_.delegationId,
          input,
          arguments_.createdBy,
        );

        subtasks.push(subtask);
      }

      return {
        success: true,
        subtasks,
        message: `Created ${subtasks.length} subtask(s) for delegation ${arguments_.delegationId}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getAgentWorkload(arguments_: any): Promise<any> {
    try {
      const workload = await this.service.getAgentWorkload(arguments_.agentId);

      return {
        success: true,
        workload,
        summary: {
          totalFeatures: workload.activeFeatures.length,
          totalDelegations: workload.activeFeatures.reduce(
            (sum, f) => sum + f.myDelegations.length,
            0,
          ),
          featuresByPriority: workload.activeFeatures.reduce(
            (acc, f) => {
              acc[f.feature.priority] = (acc[f.feature.priority] || 0) + 1;

              return acc;
            },
            {} as Record<string, number>,
          ),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getFeatures(arguments_: any): Promise<any> {
    try {
      const filters: FeatureFilters = {
        status: arguments_.status,
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
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getFeature(arguments_: any): Promise<any> {
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
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async acceptDelegation(arguments_: any): Promise<any> {
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
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async updateSubtask(arguments_: any): Promise<any> {
    try {
      const updates: UpdateSubtaskInput = {
        status: arguments_.status,
        output: arguments_.output,
        blockedReason: arguments_.blockedReason,
      };

      // Remove undefined properties
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof UpdateSubtaskInput] === undefined) {
          delete updates[key as keyof UpdateSubtaskInput];
        }
      });

      await this.service.updateSubtask(
        arguments_.featureId,
        arguments_.subtaskId,
        updates,
        arguments_.updatedBy,
      );

      return {
        success: true,
        message: `Subtask ${arguments_.subtaskId} updated successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
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
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
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
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
