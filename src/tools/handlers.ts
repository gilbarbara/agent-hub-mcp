import path from 'path';

import { createAgentFromProjectPath } from '~/agents/detection';
import { AgentService } from '~/agents/service';
import { AgentSession } from '~/agents/session';
import { FeaturesHandler } from '~/features/handlers';
import { createMessageHandlers } from '~/messaging/handlers';
import { MessageService } from '~/messaging/service';
import { validateToolInput } from '~/validation';

import {
  AcceptDelegationInput,
  AgentRegistration,
  CreateFeatureInput,
  CreateSubtaskInput,
  CreateTaskInput,
  GetFeatureInput,
  GetFeaturesInput,
  GetMessagesInput,
  RegisterAgentInput,
  SendMessageInput,
  StorageAdapter,
  SyncErrorResult,
  SyncInput,
  SyncResult,
  UpdateSubtaskInput,
} from '~/types';

export interface ToolHandlerServices {
  agentService: AgentService;
  broadcastNotification: (method: string, params: unknown) => Promise<void>;
  getCurrentSession: () => AgentSession | undefined;
  messageService: MessageService;
  sendNotificationToAgent: (agentId: string, method: string, params: unknown) => Promise<void>;
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
    async send_message(arguments_: SendMessageInput) {
      const validatedArguments = validateToolInput('send_message', arguments_);

      // Instant notification is now handled directly in the message handler
      return messageHandlers.send_message(validatedArguments);
    },

    async get_messages(arguments_: GetMessagesInput) {
      const validatedArguments = validateToolInput('get_messages', arguments_);

      return messageHandlers.get_messages(validatedArguments);
    },

    async register_agent(arguments_: RegisterAgentInput) {
      const validatedArguments = validateToolInput('register_agent', arguments_);
      const currentSession = services.getCurrentSession();
      let agent: AgentRegistration;
      let isExistingAgent = false;

      const { projectPath } = validatedArguments;

      // Determine the agent ID that would be used
      const proposedAgentId = validatedArguments.id
        ? validatedArguments.id
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
          agent.role = validatedArguments.role;
        }

        // Merge capabilities if provided
        if (validatedArguments.capabilities) {
          agent.capabilities = [
            ...new Set([...agent.capabilities, ...validatedArguments.capabilities]),
          ];
        }

        // Update collaboratesWith if provided
        if (validatedArguments.collaboratesWith) {
          agent.collaboratesWith = validatedArguments.collaboratesWith;
        }
      } else {
        // No existing agent - create new one with clean ID (no random suffix)
        const agentId = validatedArguments.id
          ? validatedArguments.id // User provided ID - use as-is
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
            agent.role = validatedArguments.role;
          }

          // Set collaboratesWith if provided
          if (validatedArguments.collaboratesWith) {
            agent.collaboratesWith = validatedArguments.collaboratesWith;
          }
        } else {
          // Manual registration with provided info only
          agent = {
            id: agentId,
            projectPath,
            role: validatedArguments.role,
            capabilities: validatedArguments.capabilities ?? [],
            status: 'active',
            lastSeen: Date.now(),
            collaboratesWith: validatedArguments.collaboratesWith ?? [],
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
      // eslint-disable-next-line unicorn/prefer-ternary
      if (isExistingAgent) {
        await services.broadcastNotification('agent_rejoined', { agent });
      } else {
        await services.broadcastNotification('agent_joined', { agent });
      }

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

    async get_hub_status(arguments_: Record<string, never>) {
      validateToolInput('get_hub_status', arguments_);

      return services.agentService.getHubStatus();
    },

    // Features system tools
    async create_feature(arguments_: CreateFeatureInput) {
      const result = await featuresHandler.handleFeatureTool('create_feature', arguments_);

      // Broadcast feature creation notification
      if (result.success) {
        await services.broadcastNotification('feature_created', {
          feature: result.feature,
        });
      }

      return result;
    },

    async create_task(arguments_: CreateTaskInput) {
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

    async create_subtask(arguments_: CreateSubtaskInput) {
      return featuresHandler.handleFeatureTool('create_subtask', arguments_);
    },

    async get_features(arguments_: GetFeaturesInput) {
      return featuresHandler.handleFeatureTool('get_features', arguments_);
    },

    async get_feature(arguments_: GetFeatureInput) {
      return featuresHandler.handleFeatureTool('get_feature', arguments_);
    },

    async accept_delegation(arguments_: AcceptDelegationInput) {
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

    async update_subtask(arguments_: UpdateSubtaskInput) {
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

    async sync(arguments_: SyncInput): Promise<SyncResult | SyncErrorResult> {
      const validatedArguments = validateToolInput('sync', arguments_);
      const { agentId } = validatedArguments;
      const markAsRead = validatedArguments.markAsRead !== false; // Default to true

      try {
        // Execute all sync operations in parallel
        const [messagesResult, workloadRaw, hubStatusResult] = await Promise.all([
          messageHandlers.get_messages({ agent: agentId, markAsRead }),
          services.storage.getAgentWorkload(agentId),
          services.agentService.getHubStatus(),
        ]);

        // Flatten workload result structure for clarity
        const workloadResult = {
          success: true,
          activeFeatures: workloadRaw.activeFeatures,
          summary: {
            totalFeatures: workloadRaw.activeFeatures.length,
            totalDelegations: workloadRaw.activeFeatures.reduce(
              (sum, f) => sum + f.myDelegations.length,
              0,
            ),
            featuresByPriority: workloadRaw.activeFeatures.reduce(
              (acc, f) => {
                acc[f.feature.priority] = (acc[f.feature.priority] || 0) + 1;

                return acc;
              },
              {} as Record<string, number>,
            ),
          },
        };

        return {
          success: true,
          timestamp: Date.now(),
          messages: messagesResult,
          workload: workloadResult,
          hubStatus: hubStatusResult,
        };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        };
      }
    },
  };
}
