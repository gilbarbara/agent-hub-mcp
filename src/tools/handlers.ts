import path from 'path';

import { createId } from '@paralleldrive/cuid2';

import { createAgentFromProjectPath } from '../agents/detection.js';
import { sendWelcomeMessage } from '../agents/registration.js';
import { AgentSession } from '../agents/session.js';
import { createContextHandlers } from '../context/handlers.js';
import { ContextService } from '../context/service.js';
import { createMessageHandlers } from '../messaging/handlers.js';
import { MessageService } from '../messaging/service.js';
import { FileStorage } from '../storage.js';
import { createTaskHandlers } from '../tasks/handlers.js';
import { TaskService } from '../tasks/service.js';
import { AgentRegistration } from '../types.js';

export interface ToolHandlerServices {
  broadcastNotification: (method: string, params: any) => Promise<void>;
  contextService: ContextService;
  getCurrentSession: () => AgentSession | undefined;
  messageService: MessageService;
  sendNotificationToAgent: (agentId: string, method: string, params: any) => Promise<void>;
  sendResourceNotification?: (agentId: string, uri: string) => Promise<void>;
  storage: FileStorage;
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
      // Instant notification is now handled directly in the message handler
      return messageHandlers.send_message(arguments_);
    },

    async get_messages(arguments_: any) {
      return messageHandlers.get_messages(arguments_);
    },

    async set_context(arguments_: any) {
      const result = await contextHandlers.set_context(arguments_);

      // Broadcast context update notification
      // The notification service will convert this to MCP's sendResourceListChanged
      await services.broadcastNotification('context_updated', {
        key: arguments_.key,
        namespace: arguments_.namespace,
        version: result.version,
      });

      return result;
    },

    async get_context(arguments_: any) {
      return contextHandlers.get_context(arguments_);
    },

    async register_agent(arguments_: any) {
      const currentSession = services.getCurrentSession();
      let agent: AgentRegistration;

      // Validate required fields
      if (!arguments_.projectPath || !arguments_.role) {
        throw new Error('Missing required fields: projectPath and role are required');
      }

      const projectPath = arguments_.projectPath as string;

      // Generate agent ID with suffix for uniqueness
      let agentId: string;
      const randomSuffix = createId().slice(0, 5);

      if (arguments_.id) {
        // User provided ID: helpers → helpers-x3k2m
        const baseId = arguments_.id as string;

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
        if (arguments_.capabilities) {
          agent.capabilities = [...new Set([...agent.capabilities, ...arguments_.capabilities])];
        }

        // Use provided role if specified
        if (arguments_.role) {
          agent.role = arguments_.role as string;
        }
      } else {
        // Manual registration with provided info only
        agent = {
          id: agentId,
          projectPath,
          role: arguments_.role as string,
          capabilities: (arguments_.capabilities as string[]) || [],
          status: 'active',
          lastSeen: Date.now(),
          collaboratesWith: (arguments_.collaboratesWith as string[]) || [],
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
      const result = await taskHandlers.update_task_status(arguments_);

      // Broadcast task update notification
      // The notification service will convert this to MCP's sendResourceListChanged
      await services.broadcastNotification('task_updated', {
        agent: arguments_.agent,
        task: arguments_.task,
        status: arguments_.status,
      });

      return result;
    },

    async get_agent_status(arguments_: any) {
      return taskHandlers.get_agent_status(arguments_);
    },

    async start_collaboration(arguments_: any) {
      return taskHandlers.start_collaboration(arguments_);
    },

    async sync_request(arguments_: any) {
      const result = await messageHandlers.sync_request(arguments_);

      // Send instant notification for sync request
      await services.sendNotificationToAgent(arguments_.to, 'sync_request', {
        from: arguments_.from,
        topic: arguments_.topic,
      });

      return result;
    },

    async approve_agent(arguments_: any) {
      const { agentId, approve, reason } = arguments_;

      // Get the pending agent
      const agents = await services.storage.getAgents();
      const pendingAgent = agents.find(a => a.id === agentId && a.status === 'pending');

      if (!pendingAgent) {
        throw new Error(`No pending agent found with ID: ${agentId}`);
      }

      if (approve) {
        // Approve the agent
        pendingAgent.status = 'active';
        await services.storage.saveAgent(pendingAgent);

        // Broadcast approval notification
        await services.broadcastNotification('agent_approved', {
          agent: pendingAgent,
          approvedBy: services.getCurrentSession()?.agent?.id || 'hub-admin',
        });

        return {
          approved: true,
          agent: pendingAgent,
          message: `✅ Agent ${agentId} has been approved and is now active`,
        };
      }

      // Reject the agent - remove from storage
      const allAgents = await services.storage.getAgents();
      const filteredAgents = allAgents.filter(a => a.id !== agentId);

      await services.storage.saveAllAgents(filteredAgents);

      // Broadcast rejection notification
      await services.broadcastNotification('agent_rejected', {
        agentId,
        reason: reason || 'No reason provided',
      });

      return {
        approved: false,
        message: `❌ Agent ${agentId} has been rejected`,
        reason,
      };
    },

    async set_approval_required(arguments_: any) {
      const { enabled, trustedAgents } = arguments_;

      // Store approval settings in context
      await services.contextService.setContext(
        'hub:settings:require_approval',
        enabled,
        services.getCurrentSession()?.agent?.id || 'hub-admin',
        { namespace: 'system' },
      );

      if (trustedAgents && trustedAgents.length > 0) {
        await services.contextService.setContext(
          'hub:trusted_agents',
          trustedAgents,
          services.getCurrentSession()?.agent?.id || 'hub-admin',
          { namespace: 'system' },
        );
      }

      return {
        success: true,
        approvalRequired: enabled,
        trustedAgents: trustedAgents || [],
        message: `Approval requirement ${enabled ? 'enabled' : 'disabled'}`,
      };
    },
  };
}
