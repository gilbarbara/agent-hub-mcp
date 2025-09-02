import path from 'path';

import { createAgentFromProjectPath } from '~/agents/detection';
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
      let isExistingAgent = false;

      const projectPath = validatedArguments.projectPath as string;

      // Determine the agent ID that would be used
      const proposedAgentId = validatedArguments.id
        ? (validatedArguments.id as string)
        : path.basename(projectPath);

      // Check for conflicts: existing agent ID with different project path
      if (validatedArguments.id) {
        const existingAgentById = await services.storage.findAgentById(proposedAgentId);

        if (existingAgentById && existingAgentById.projectPath !== projectPath) {
          return {
            success: false,
            error: 'AGENT_ID_CONFLICT',
            message: `❌ Agent ID '${proposedAgentId}' is already registered with a different project path (${existingAgentById.projectPath}). Cannot register with ${projectPath}.`,
            existingAgent: {
              id: existingAgentById.id,
              projectPath: existingAgentById.projectPath,
              role: existingAgentById.role,
            },
          };
        }
      }

      // Check if an agent already exists for this project path
      const existingAgent = await services.storage.findAgentByProjectPath(projectPath);

      if (existingAgent) {
        // Agent exists - update it instead of creating new one
        isExistingAgent = true;
        agent = existingAgent;

        // Update agent properties
        agent.lastSeen = Date.now();
        agent.status = 'active';

        // Update role if provided
        if (validatedArguments.role) {
          agent.role = validatedArguments.role as string;
        }

        // Merge capabilities if provided
        if (validatedArguments.capabilities) {
          agent.capabilities = [
            ...new Set([...agent.capabilities, ...validatedArguments.capabilities]),
          ];
        }

        // Update collaboratesWith if provided
        if (validatedArguments.collaboratesWith) {
          agent.collaboratesWith = validatedArguments.collaboratesWith as string[];
        }
      } else {
        // No existing agent - create new one with clean ID (no random suffix)
        const agentId = validatedArguments.id
          ? (validatedArguments.id as string) // User provided ID - use as-is
          : path.basename(projectPath); // No ID provided: extract from project path

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

          // Set collaboratesWith if provided
          if (validatedArguments.collaboratesWith) {
            agent.collaboratesWith = validatedArguments.collaboratesWith as string[];
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
      }

      // Ensure agent is active
      agent.status = 'active';

      // Update session with agent
      if (currentSession) {
        currentSession.agent = agent;
      }

      await services.storage.saveAgent(agent);

      // Broadcast appropriate notification
      await (isExistingAgent
        ? services.broadcastNotification('agent_rejoined', { agent })
        : services.broadcastNotification('agent_joined', { agent }));

      // Return enhanced response with feedback
      const actionVerb = isExistingAgent ? 'reconnected' : 'registered';

      return {
        success: true,
        agent,
        message: `✅ Agent ${actionVerb} successfully! ${isExistingAgent ? 'Welcome back' : 'Welcome'} ${agent.id} (${agent.role}).`,
        detectedCapabilities: agent.capabilities,
        collaborationReady: true,
        reconnected: isExistingAgent,
      };
    },

    async get_hub_status(arguments_: any) {
      validateToolInput('get_hub_status', arguments_);

      return services.agentService.getHubStatus();
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
