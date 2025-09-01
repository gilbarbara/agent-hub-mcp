import path from 'path';

import { createId } from '@paralleldrive/cuid2';

import { createAgentFromProjectPath } from '~/agents/detection';
import { sendWelcomeMessage } from '~/agents/registration';
import { AgentService } from '~/agents/service';
import { AgentSession } from '~/agents/session';
import { FeaturesHandler } from '~/features/handlers';
import { createMessageHandlers } from '~/messaging/handlers';
import { MessageService } from '~/messaging/service';
import { StorageAdapter } from '~/storage';
import { validateToolInput } from '~/validation';

import { AgentRegistration } from '~/types';

export interface ToolHandlerServices {
  agentService: AgentService;
  broadcastNotification: (method: string, params: any) => Promise<void>;
  getCurrentSession: () => AgentSession | undefined;
  messageService: MessageService;
  sendNotificationToAgent: (agentId: string, method: string, params: any) => Promise<void>;
  sendResourceNotification?: (agentId: string, uri: string) => Promise<void>;
  storage: StorageAdapter;
}

export function createToolHandlers(services: ToolHandlerServices) {
  const messageHandlers = createMessageHandlers(
    services.messageService,
    services.storage,
    services.sendNotificationToAgent,
    services.sendResourceNotification,
  );
  const featuresHandler = new FeaturesHandler(services.storage);

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

    async get_agent_status(arguments_: any) {
      const validatedArguments = validateToolInput('get_agent_status', arguments_);

      return services.agentService.getAgentStatus(validatedArguments.agent);
    },

    // Features system tools
    async create_feature(arguments_: any) {
      const result = await featuresHandler.handleFeatureTool('create_feature', arguments_);

      // Broadcast feature creation notification
      if (result.success) {
        await services.broadcastNotification('feature_created', {
          feature: result.feature,
        });
      }

      return result;
    },

    async create_task(arguments_: any) {
      const result = await featuresHandler.handleFeatureTool('create_task', arguments_);

      // Broadcast task creation notification
      if (result.success) {
        await services.broadcastNotification('task_created', {
          featureId: arguments_.featureId,
          task: result.task,
          delegations: result.delegations,
        });
      }

      return result;
    },

    async create_subtask(arguments_: any) {
      return featuresHandler.handleFeatureTool('create_subtask', arguments_);
    },

    async get_agent_workload(arguments_: any) {
      return featuresHandler.handleFeatureTool('get_agent_workload', arguments_);
    },

    async get_features(arguments_: any) {
      return featuresHandler.handleFeatureTool('get_features', arguments_);
    },

    async get_feature(arguments_: any) {
      return featuresHandler.handleFeatureTool('get_feature', arguments_);
    },

    async accept_delegation(arguments_: any) {
      const result = await featuresHandler.handleFeatureTool('accept_delegation', arguments_);

      // Broadcast delegation acceptance notification
      if (result.success) {
        await services.broadcastNotification('delegation_accepted', {
          featureId: arguments_.featureId,
          delegationId: arguments_.delegationId,
          agentId: arguments_.agentId,
        });
      }

      return result;
    },

    async update_subtask(arguments_: any) {
      const result = await featuresHandler.handleFeatureTool('update_subtask', arguments_);

      // Broadcast subtask update notification
      if (result.success) {
        await services.broadcastNotification('subtask_updated', {
          featureId: arguments_.featureId,
          subtaskId: arguments_.subtaskId,
          status: arguments_.status,
        });
      }

      return result;
    },
  };
}
