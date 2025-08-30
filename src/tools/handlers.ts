import path from 'path';

import { createId } from '@paralleldrive/cuid2';

import { createAgentFromProjectPath } from '~/agents/detection';
import { sendWelcomeMessage } from '~/agents/registration';
import { AgentSession } from '~/agents/session';
import { createContextHandlers } from '~/context/handlers';
import { ContextService } from '~/context/service';
import { createMessageHandlers } from '~/messaging/handlers';
import { MessageService } from '~/messaging/service';
import { StorageAdapter } from '~/storage';
import { createTaskHandlers } from '~/tasks/handlers';
import { TaskService } from '~/tasks/service';
import { validateToolInput } from '~/validation';

import { AgentRegistration } from '~/types';

export interface ToolHandlerServices {
  broadcastNotification: (method: string, params: any) => Promise<void>;
  contextService: ContextService;
  getCurrentSession: () => AgentSession | undefined;
  messageService: MessageService;
  sendNotificationToAgent: (agentId: string, method: string, params: any) => Promise<void>;
  sendResourceNotification?: (agentId: string, uri: string) => Promise<void>;
  storage: StorageAdapter;
  taskService: TaskService;
}

export function createToolHandlers(services: ToolHandlerServices) {
  const messageHandlers = createMessageHandlers(
    services.messageService,
    services.storage,
    services.sendNotificationToAgent,
    services.sendResourceNotification,
  );
  const contextHandlers = createContextHandlers(services.contextService);
  const taskHandlers = createTaskHandlers(services.taskService);

  return {
    async send_message(arguments_: any) {
      const validatedArguments = validateToolInput('send_message', arguments_);

      // Instant notification is now handled directly in the message handler
      return messageHandlers.send_message(validatedArguments);
    },

    async get_messages(arguments_: any) {
      const validatedArguments = validateToolInput('get_messages', arguments_);

      return messageHandlers.get_messages(validatedArguments);
    },

    async set_context(arguments_: any) {
      const validatedArguments = validateToolInput('set_context', arguments_);
      const result = await contextHandlers.set_context(validatedArguments);

      // Broadcast context update notification
      // The notification service will convert this to MCP's sendResourceListChanged
      await services.broadcastNotification('context_updated', {
        key: validatedArguments.key,
        namespace: validatedArguments.namespace,
        version: result.version,
      });

      return result;
    },

    async get_context(arguments_: any) {
      const validatedArguments = validateToolInput('get_context', arguments_);

      return contextHandlers.get_context(validatedArguments);
    },

    async register_agent(arguments_: any) {
      const validatedArguments = validateToolInput('register_agent', arguments_);
      const currentSession = services.getCurrentSession();
      let agent: AgentRegistration;

      const projectPath = validatedArguments.projectPath as string;

      // Generate agent ID with suffix for uniqueness
      let agentId: string;
      const randomSuffix = createId().slice(0, 5);

      if (validatedArguments.id) {
        // User provided ID: helpers → helpers-x3k2m
        const baseId = validatedArguments.id as string;

        agentId = `${baseId}-${randomSuffix}`;
      } else {
        // No ID provided: extract from project path
        // /Users/name/helpers → helpers-x3k2m
        const projectName = path.basename(projectPath);

        agentId = `${projectName}-${randomSuffix}`;
      }

      // Create agent using project-based detection
      if (projectPath && projectPath !== 'unknown') {
        // Use provided project path for auto-detection
        agent = await createAgentFromProjectPath(agentId, projectPath);

        // Merge with any provided capabilities
        if (validatedArguments.capabilities) {
          agent.capabilities = [
            ...new Set([...agent.capabilities, ...validatedArguments.capabilities]),
          ];
        }

        // Use provided role if specified
        if (validatedArguments.role) {
          agent.role = validatedArguments.role as string;
        }
      } else {
        // Manual registration with provided info only
        agent = {
          id: agentId,
          projectPath,
          role: validatedArguments.role as string,
          capabilities: (validatedArguments.capabilities as string[]) ?? [],
          status: 'active',
          lastSeen: Date.now(),
          collaboratesWith: (validatedArguments.collaboratesWith as string[]) ?? [],
        };
      }

      // No approval required - directly activate agent
      agent.status = 'active';

      // Update session with new agent
      if (currentSession) {
        currentSession.agent = agent;
      }

      await services.storage.saveAgent(agent);

      // Broadcast agent joined notification
      await services.broadcastNotification('agent_joined', { agent });

      // Send welcome message to new agent
      await sendWelcomeMessage(services.storage, agent);

      // Return enhanced response with feedback
      return {
        success: true,
        agent,
        message: `✅ Agent registered successfully! Welcome ${agent.id} (${agent.role}).`,
        detectedCapabilities: agent.capabilities,
        collaborationReady: true,
      };
    },

    async update_task_status(arguments_: any) {
      const validatedArguments = validateToolInput('update_task_status', arguments_);
      const result = await taskHandlers.update_task_status(validatedArguments);

      // Broadcast task update notification
      // The notification service will convert this to MCP's sendResourceListChanged
      await services.broadcastNotification('task_updated', {
        agent: validatedArguments.agent,
        task: validatedArguments.task,
        status: validatedArguments.status,
      });

      return result;
    },

    async get_agent_status(arguments_: any) {
      const validatedArguments = validateToolInput('get_agent_status', arguments_);

      return taskHandlers.get_agent_status(validatedArguments);
    },

    async start_collaboration(arguments_: any) {
      const validatedArguments = validateToolInput('start_collaboration', arguments_);

      return taskHandlers.start_collaboration(validatedArguments);
    },

    async sync_request(arguments_: any) {
      const validatedArguments = validateToolInput('sync_request', arguments_);
      const result = await messageHandlers.sync_request(validatedArguments);

      // Send instant notification for sync request
      await services.sendNotificationToAgent(validatedArguments.to, 'sync_request', {
        from: validatedArguments.from,
        topic: validatedArguments.topic,
      });

      return result;
    },
  };
}
