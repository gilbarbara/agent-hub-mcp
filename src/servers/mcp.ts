import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { AgentSession } from '../agents/session.js';
import { ContextService } from '../context/service.js';
import { MessageService } from '../messaging/service.js';
import { FileStorage } from '../storage.js';
import { TaskService } from '../tasks/service.js';
import { TOOLS } from '../tools/definitions.js';
import { createToolHandlers, ToolHandlerServices } from '../tools/handlers.js';

export interface McpServerDependencies {
  broadcastNotification: (method: string, params: any) => Promise<void>;
  contextService: ContextService;
  getCurrentSession: () => AgentSession | undefined;
  messageService: MessageService;
  sendNotificationToAgent: (agentId: string, method: string, params: any) => Promise<void>;
  sendResourceNotification?: (agentId: string, uri: string) => Promise<void>;
  storage: FileStorage;
  taskService: TaskService;
}

export function createMcpServer(deps: McpServerDependencies): Server {
  const server = new Server(
    {
      name: 'agent-hub-mcp',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {
          subscribe: true,
          listChanged: true,
        },
      },
    },
  );

  // Helper function to update agent's lastSeen timestamp
  async function updateAgentLastSeen(): Promise<void> {
    const currentSession = deps.getCurrentSession();

    if (currentSession?.agent) {
      await deps.storage.updateAgent(currentSession.agent.id, {
        lastSeen: Date.now(),
        status: 'active', // Ensure they're marked active when making requests
      });
    }
  }

  const toolHandlerServices: ToolHandlerServices = {
    storage: deps.storage,
    messageService: deps.messageService,
    contextService: deps.contextService,
    taskService: deps.taskService,
    getCurrentSession: deps.getCurrentSession,
    broadcastNotification: deps.broadcastNotification,
    sendNotificationToAgent: deps.sendNotificationToAgent,
    sendResourceNotification: deps.sendResourceNotification,
  };

  const toolHandlers = createToolHandlers(toolHandlerServices);

  // Custom initialize handler to include collaboration state
  server.setRequestHandler(InitializeRequestSchema, async request => {
    const agents = await deps.storage.getAgents();
    const activeAgents = agents.filter(a => Date.now() - a.lastSeen < 5 * 60 * 1000);
    const totalMessages = await deps.storage.getMessages({});
    const unreadCount = totalMessages.filter(m => !m.read).length;

    return {
      protocolVersion: request.params.protocolVersion,
      capabilities: {
        tools: {},
        resources: {
          subscribe: true,
          listChanged: true,
        },
      },
      serverInfo: {
        name: 'agent-hub-mcp',
        version: '0.2.0',
        activeAgents: activeAgents.length,
        totalMessages: unreadCount,
        collaborationHints: activeAgents.map(a => ({
          id: a.id,
          role: a.role,
          capabilities: a.capabilities,
        })),
      },
      instructions: `🟢 CONNECTED TO AGENT-HUB | Registration Required

⚠️ REGISTRATION PENDING - Complete registration to enable collaboration:

register_agent({
  "id": "your-project-name",
  "projectPath": "/full/path/to/your/project", 
  "role": "Your Role"
})

Quick Examples:
register_agent({"id": "react-app", "projectPath": "/Users/name/my-react-app", "role": "Frontend Developer"})
register_agent({"id": "api-server", "projectPath": "/Users/name/my-api", "role": "Backend Developer"})

After registration you'll get:
✓ Real-time notifications  ✓ Capability detection  ✓ Agent collaboration

${
  activeAgents.length > 0
    ? `🤝 ${activeAgents.length} registered agent(s) waiting to collaborate`
    : '👋 You are the first agent to connect'
}`,
    };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Resource handlers for agent discovery
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const contexts = await deps.storage.getContext();
    const currentSession = deps.getCurrentSession();

    const resources = [
      {
        uri: 'agent-hub://agents',
        name: 'Active Agents',
        description: 'List of all active agents in the hub',
        mimeType: 'application/json',
      },
      {
        uri: 'agent-hub://collaboration',
        name: 'Collaboration Opportunities',
        description: 'Current collaboration sessions and opportunities',
        mimeType: 'application/json',
      },
    ];

    // Add self resource if agent is registered
    if (currentSession?.agent) {
      resources.push(
        {
          uri: 'agent-hub://self',
          name: 'My Agent Info',
          description: "This agent's registration and status",
          mimeType: 'application/json',
        },
        {
          uri: `agent-hub://messages/${currentSession.agent.id}`,
          name: 'My Messages',
          description: 'Messages for this agent',
          mimeType: 'application/json',
        },
      );
    }

    // Add dynamic context resources
    Object.keys(contexts).forEach(key => {
      const context = contexts[key];

      if (context.namespace) {
        resources.push({
          uri: `agent-hub://context/${context.namespace}`,
          name: `Context: ${context.namespace}`,
          description: `Shared context for ${context.namespace}`,
          mimeType: 'application/json',
        });
      }
    });

    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const { uri } = request.params;
    const currentSession = deps.getCurrentSession();

    // Handle self resource
    if (uri === 'agent-hub://self' && currentSession?.agent) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                id: currentSession.agent.id,
                role: currentSession.agent.role,
                capabilities: currentSession.agent.capabilities,
                projectPath: currentSession.agent.projectPath,
                status: currentSession.agent.status,
                lastSeen: currentSession.agent.lastSeen,
                collaboratesWith: currentSession.agent.collaboratesWith,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Handle agent-specific messages
    if (uri.startsWith('agent-hub://messages/')) {
      const agentId = uri.replace('agent-hub://messages/', '');
      const messages = await deps.storage.getMessages({ agent: agentId });
      const unreadMessages = messages.filter(m => !m.read && (m.to === agentId || m.to === 'all'));

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                agentId,
                totalMessages: messages.length,
                unreadCount: unreadMessages.length,
                messages: unreadMessages.slice(0, 10).map(m => ({
                  id: m.id,
                  from: m.from,
                  type: m.type,
                  content: m.content,
                  timestamp: m.timestamp,
                  priority: m.priority,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (uri === 'agent-hub://agents') {
      const agents = await deps.storage.getAgents();
      const activeAgents = agents.filter(a => Date.now() - a.lastSeen < 5 * 60 * 1000);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                total: agents.length,
                active: activeAgents.length,
                agents: activeAgents.map(a => ({
                  id: a.id,
                  role: a.role,
                  capabilities: a.capabilities,
                  projectPath: a.projectPath,
                  lastSeen: a.lastSeen,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (uri === 'agent-hub://collaboration') {
      const tasks = await deps.storage.getTasks();
      const messages = await deps.storage.getMessages({});
      const unreadMessages = messages.filter(m => !m.read);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                activeTasks: tasks.filter(t => t.status === 'in-progress').length,
                pendingMessages: unreadMessages.length,
                recentActivity: unreadMessages.slice(0, 5).map(m => ({
                  from: m.from,
                  to: m.to,
                  type: m.type,
                  preview: m.content.slice(0, 100),
                  timestamp: m.timestamp,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (uri.startsWith('agent-hub://context/')) {
      const namespace = uri.replace('agent-hub://context/', '');
      const contexts = await deps.storage.getContext(undefined, namespace);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(contexts, null, 2),
          },
        ],
      };
    }

    throw new Error(`Resource not found: ${uri}`);
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { arguments: arguments_, name } = request.params;

    // Update agent's lastSeen timestamp for any tool call
    await updateAgentLastSeen();

    if (!arguments_) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'No arguments provided' }),
          },
        ],
      };
    }

    try {
      const handler = toolHandlers[name as keyof typeof toolHandlers];

      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const result = await handler(arguments_);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      // Only expose safe error messages to prevent information disclosure
      let safeMessage = 'Operation failed';

      // Only show detailed errors for validation failures (safe to expose)
      if (error instanceof Error && error.message.includes('Invalid')) {
        safeMessage = error.message;
      }

      // Log the full error for debugging (server-side only)
      // eslint-disable-next-line no-console
      console.error('Tool execution error:', error);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: safeMessage }),
          },
        ],
      };
    }
  });

  return server;
}
