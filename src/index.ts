#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { v7 as uuidv7 } from 'uuid';

import { FileStorage } from './storage';
import {
  AgentRegistration,
  Message,
  MessagePriority,
  MessageType,
  SharedContext,
  TaskStatus,
} from './types';

const storage = new FileStorage(process.env.AGENT_HUB_DATA_DIR || '~/.agent-hub');

async function detectAgentFromProject(): Promise<AgentRegistration> {
  const projectPath = process.cwd();

  // Try to get project name from package.json
  let projectName = path.basename(projectPath);
  let role = 'Development agent';
  const capabilities: string[] = [];

  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    if (packageJson.name) {
      projectName = packageJson.name;
    }

    // Detect capabilities from dependencies
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.react) {
      capabilities.push('react', 'frontend');
    }

    if (deps.vue) {
      capabilities.push('vue', 'frontend');
    }

    if (deps.express || deps.fastify) {
      capabilities.push('api', 'backend');
    }

    if (deps.typescript) {
      capabilities.push('typescript');
    }

    if (deps.jest || deps.vitest) {
      capabilities.push('testing');
    }
  } catch {
    // Fallback if no package.json or read fails
  }

  // Detect role based on project structure
  try {
    const files = await fs.readdir(projectPath);

    if (files.includes('src') && files.includes('public')) {
      role = 'Frontend development agent';
    } else if (files.includes('src') && capabilities.includes('api')) {
      role = 'Backend development agent';
    } else if (files.includes('.agent-hub')) {
      role = 'Agent hub coordinator';
    }
  } catch {
    // Fallback
  }

  return {
    id: projectName,
    projectPath,
    role,
    capabilities,
    status: 'active',
    lastSeen: Date.now(),
    collaboratesWith: [],
  };
}

async function ensureAgentRegistered(agentId?: string): Promise<string> {
  let finalAgentId: string;

  if (!agentId) {
    const detectedAgent = await detectAgentFromProject();

    finalAgentId = detectedAgent.id;
  } else {
    finalAgentId = agentId;
  }

  const existingAgents = await storage.getAgents(finalAgentId);

  if (existingAgents.length === 0) {
    // Create new agent registration
    const agentToSave = agentId
      ? {
          id: finalAgentId,
          projectPath: process.cwd(),
          role: 'Auto-registered agent',
          capabilities: [],
          status: 'active' as const,
          lastSeen: Date.now(),
          collaboratesWith: [],
        }
      : await detectAgentFromProject();

    await storage.saveAgent(agentToSave);
  } else {
    // Update lastSeen for existing agent
    const agent = existingAgents[0];

    agent.lastSeen = Date.now();
    agent.status = 'active';
    await storage.saveAgent(agent);
  }

  return finalAgentId;
}

const server = new Server(
  {
    name: 'agent-hub-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const TOOLS: Tool[] = [
  {
    name: 'send_message',
    description: 'Send a message to another agent or broadcast to all agents',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source agent identifier' },
        to: { type: 'string', description: 'Target agent identifier or "all" for broadcast' },
        type: {
          type: 'string',
          enum: Object.values(MessageType),
          description: 'Message type',
        },
        content: { type: 'string', description: 'Message content' },
        metadata: { type: 'object', description: 'Additional structured data' },
        priority: {
          type: 'string',
          enum: Object.values(MessagePriority),
          description: 'Message priority',
          default: MessagePriority.NORMAL,
        },
        threadId: { type: 'string', description: 'Optional conversation thread ID' },
      },
      required: ['from', 'to', 'type', 'content'],
    },
  },
  {
    name: 'get_messages',
    description: 'Retrieve messages for an agent',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent identifier to get messages for' },
        markAsRead: {
          type: 'boolean',
          description: 'Mark retrieved messages as read',
          default: true,
        },
        type: {
          type: 'string',
          enum: Object.values(MessageType),
          description: 'Filter by message type',
        },
        since: { type: 'number', description: 'Get messages since timestamp' },
      },
      required: ['agent'],
    },
  },
  {
    name: 'set_context',
    description: 'Store a value in the shared context',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Context key' },
        value: { description: 'Context value (any JSON-serializable data)' },
        agent: { type: 'string', description: 'Agent setting the context' },
        ttl: { type: 'number', description: 'Time-to-live in milliseconds' },
        namespace: { type: 'string', description: 'Optional namespace for organization' },
      },
      required: ['key', 'value', 'agent'],
    },
  },
  {
    name: 'get_context',
    description: 'Retrieve values from the shared context',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Specific context key to retrieve' },
        namespace: { type: 'string', description: 'Filter by namespace' },
      },
    },
  },
  {
    name: 'register_agent',
    description: 'Register an agent with the hub',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent identifier' },
        projectPath: { type: 'string', description: 'Agent working directory' },
        role: { type: 'string', description: 'Agent role description' },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agent capabilities',
        },
        collaboratesWith: {
          type: 'array',
          items: { type: 'string' },
          description: 'Expected collaborators',
        },
      },
      required: ['id', 'projectPath', 'role'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent working on the task' },
        task: { type: 'string', description: 'Task identifier or description' },
        status: {
          type: 'string',
          enum: ['started', 'in-progress', 'completed', 'blocked'],
          description: 'Task status',
        },
        details: { type: 'string', description: 'Additional details' },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task dependencies',
        },
      },
      required: ['agent', 'task', 'status'],
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get status of agents and their tasks',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Specific agent to query' },
      },
    },
  },
  {
    name: 'start_collaboration',
    description: 'Initialize collaboration for a feature',
    inputSchema: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Feature name or identifier' },
        agent: { type: 'string', description: 'Agent starting the collaboration' },
      },
      required: ['feature'],
    },
  },
  {
    name: 'sync_request',
    description: 'Send a synchronous request to another agent and wait for response',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Requesting agent' },
        to: { type: 'string', description: 'Target agent' },
        topic: { type: 'string', description: 'Topic or question' },
        timeout: { type: 'number', description: 'Timeout in milliseconds', default: 30000 },
      },
      required: ['from', 'to', 'topic'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { arguments: arguments_, name } = request.params;

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
    switch (name) {
      case 'send_message': {
        // Auto-register sender if needed
        const fromAgent = await ensureAgentRegistered(arguments_.from as string);

        const message: Message = {
          id: uuidv7(),
          from: fromAgent,
          to: arguments_.to as string,
          type: arguments_.type as MessageType,
          content: arguments_.content as string,
          metadata: arguments_.metadata as Record<string, any>,
          timestamp: Date.now(),
          read: false,
          threadId: arguments_.threadId as string,
          priority: (arguments_.priority as MessagePriority) || MessagePriority.NORMAL,
        };

        await storage.saveMessage(message);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, messageId: message.id }),
            },
          ],
        };
      }
      case 'get_messages': {
        // Auto-register requesting agent if needed
        const agentId = await ensureAgentRegistered(arguments_.agent as string);

        const messages = await storage.getMessages({
          agent: agentId,
          type: arguments_.type as string,
          since: arguments_.since as number,
        });

        const unreadMessages = messages.filter(
          m => !m.read && (m.to === agentId || m.to === 'all'),
        );

        if (arguments_.markAsRead !== false) {
          for (const message of unreadMessages) {
            await storage.markMessageAsRead(message.id);
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: unreadMessages.length,
                messages: unreadMessages,
              }),
            },
          ],
        };
      }
      case 'set_context': {
        // Auto-register agent setting context if needed
        const agentId = await ensureAgentRegistered(arguments_.agent as string);

        const existingContexts = await storage.getContext(arguments_.key as string);
        const existingContext = existingContexts[arguments_.key as string];

        const context: SharedContext = {
          key: arguments_.key as string,
          value: arguments_.value,
          version: existingContext ? existingContext.version + 1 : 1,
          updatedBy: agentId,
          timestamp: Date.now(),
          ttl: arguments_.ttl as number,
          namespace: arguments_.namespace as string,
        };

        await storage.saveContext(context);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, version: context.version }),
            },
          ],
        };
      }
      case 'get_context': {
        const contexts = await storage.getContext(
          arguments_.key as string,
          arguments_.namespace as string,
        );

        const result: Record<string, any> = {};

        for (const [key, context] of Object.entries(contexts)) {
          result[key] = context.value;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }
      case 'register_agent': {
        const agent: AgentRegistration = {
          id: arguments_.id as string,
          projectPath: arguments_.projectPath as string,
          role: arguments_.role as string,
          capabilities: (arguments_.capabilities as string[]) || [],
          status: 'active',
          lastSeen: Date.now(),
          collaboratesWith: (arguments_.collaboratesWith as string[]) || [],
        };

        await storage.saveAgent(agent);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agent),
            },
          ],
        };
      }
      case 'update_task_status': {
        const task: TaskStatus = {
          id: uuidv7(),
          agent: arguments_.agent as string,
          task: arguments_.task as string,
          status: arguments_.status as 'started' | 'in-progress' | 'completed' | 'blocked',
          details: arguments_.details as string,
          dependencies: arguments_.dependencies as string[],
          timestamp: Date.now(),
        };

        await storage.saveTask(task);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true }),
            },
          ],
        };
      }
      case 'get_agent_status': {
        const agents = await storage.getAgents(arguments_.agent as string);
        const tasks = await storage.getTasks(arguments_.agent as string);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ agents, tasks }),
            },
          ],
        };
      }
      case 'start_collaboration': {
        const agentId = (arguments_.agent as string) || `agent-${Date.now()}`;
        const agents = await storage.getAgents();
        const messages = await storage.getMessages({ agent: agentId });

        const activeAgents = agents
          .filter(a => Date.now() - a.lastSeen < 5 * 60 * 1000)
          .map(a => a.id);

        const pendingMessages = messages.filter(m => !m.read).length;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                agent: agentId,
                pendingMessages,
                activeAgents,
              }),
            },
          ],
        };
      }
      case 'sync_request': {
        const syncMessage: Message = {
          id: uuidv7(),
          from: arguments_.from as string,
          to: arguments_.to as string,
          type: MessageType.SYNC_REQUEST,
          content: arguments_.topic as string,
          timestamp: Date.now(),
          read: false,
          priority: MessagePriority.URGENT,
        };

        await storage.saveMessage(syncMessage);

        const timeout = (arguments_.timeout as number) || 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          await new Promise(resolve => {
            setTimeout(resolve, 1000);
          });

          const responses = await storage.getMessages({
            agent: arguments_.from as string,
            since: syncMessage.timestamp,
          });

          const response = responses.find(
            m => m.from === arguments_.to && m.threadId === syncMessage.id,
          );

          if (response) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ response: response.content }),
                },
              ],
            };
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ timeout: true }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }),
        },
      ],
    };
  }
});

async function main() {
  await storage.init();

  const transport = new StdioServerTransport();

  await server.connect(transport);

  // eslint-disable-next-line no-console
  console.log('Agent Hub MCP server started');
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch(error => {
  // eslint-disable-next-line no-console
  console.error('Server error:', error);
  process.exit(1);
});
