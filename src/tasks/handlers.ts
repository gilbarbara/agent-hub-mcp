import { TaskService } from './service.js';

export function createTaskHandlers(taskService: TaskService) {
  return {
    async update_task_status(arguments_: any) {
      const result = await taskService.updateTaskStatus(
        arguments_.agent as string,
        arguments_.task as string,
        arguments_.status as 'started' | 'in-progress' | 'completed' | 'blocked',
        {
          details: arguments_.details as string,
          dependencies: arguments_.dependencies as string[],
        },
      );

      return result;
    },

    async get_agent_status(arguments_: any) {
      const result = await taskService.getAgentStatus(arguments_.agent as string);

      return result;
    },

    async start_collaboration(arguments_: any) {
      const result = await taskService.startCollaboration(
        arguments_.feature as string,
        arguments_.agent as string,
      );

      return result;
    },
  };
}
