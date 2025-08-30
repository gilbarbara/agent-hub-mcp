#!/usr/bin/env node

import * as path from 'path';

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { v7 as uuidv7 } from 'uuid';

import { detectProjectCapabilities } from './agents/detection';
import { FileStorage, IndexedStorage, StorageAdapter } from './storage';
import { TOOLS } from './tools/definitions';
import {
  AgentRegistration,
  Message,
  MessagePriority,
  MessageType,
  SharedContext,
  TaskStatus,
} from './types';
import { validateToolInput } from './validation';

// Choose storage implementation based on environment variable
function createStorage(): StorageAdapter {
  const dataDirectory = process.env.AGENT_HUB_DATA_DIR ?? '~/.agent-hub';
  const storageType = process.env.AGENT_HUB_STORAGE_TYPE ?? 'indexed';

  switch (storageType.toLowerCase()) {
    case 'file':
      return new FileStorage(dataDirectory);
    case 'indexed':
    default:
      return new IndexedStorage(dataDirectory);
  }
}

const storage = createStorage();

async function detectAgentFromProject(): Promise<AgentRegistration> {
  const projectPath = process.cwd();

  // Try to get project name from package.json
  let projectName = path.basename(projectPath);

  try {
    const { readFile } = await import('fs/promises');
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

    if (packageJson.name) {
      projectName = packageJson.name;
    }
  } catch {
    // Fallback if no package.json or read fails
  }

  // Use shared detection logic from agents/detection.ts
  const { capabilities, role } = await detectProjectCapabilities(projectPath);

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
    // Validate tool input against schema
    const validatedArguments = validateToolInput(name, arguments_);

    switch (name) {
      case 'send_message': {
        // Auto-register sender if needed
        const fromAgent = await ensureAgentRegistered(validatedArguments.from as string);

        const message: Message = {
          id: uuidv7(),
          from: fromAgent,
          to: validatedArguments.to as string,
          type: validatedArguments.type as MessageType,
          content: validatedArguments.content as string,
          metadata: validatedArguments.metadata as Record<string, any>,
          timestamp: Date.now(),
          read: false,
          threadId: validatedArguments.threadId as string,
          priority: (validatedArguments.priority as MessagePriority) || MessagePriority.NORMAL,
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
        const agentId = await ensureAgentRegistered(validatedArguments.agent as string);

        const messages = await storage.getMessages({
          agent: agentId,
          type: validatedArguments.type as string,
          since: validatedArguments.since as number,
        });

        const unreadMessages = messages.filter(
          m => !m.read && (m.to === agentId || m.to === 'all'),
        );

        if (validatedArguments.markAsRead !== false) {
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
        const agentId = await ensureAgentRegistered(validatedArguments.agent as string);

        const existingContexts = await storage.getContext(validatedArguments.key as string);
        const existingContext = existingContexts[validatedArguments.key as string];

        const context: SharedContext = {
          key: validatedArguments.key as string,
          value: validatedArguments.value,
          version: existingContext ? existingContext.version + 1 : 1,
          updatedBy: agentId,
          timestamp: Date.now(),
          ttl: validatedArguments.ttl as number,
          namespace: validatedArguments.namespace as string,
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
          validatedArguments.key as string,
          validatedArguments.namespace as string,
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
          id: validatedArguments.id as string,
          projectPath: validatedArguments.projectPath as string,
          role: validatedArguments.role as string,
          capabilities: (validatedArguments.capabilities as string[]) ?? [],
          status: 'active',
          lastSeen: Date.now(),
          collaboratesWith: (validatedArguments.collaboratesWith as string[]) ?? [],
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
          agent: validatedArguments.agent as string,
          task: validatedArguments.task as string,
          status: validatedArguments.status as 'started' | 'in-progress' | 'completed' | 'blocked',
          details: validatedArguments.details as string,
          dependencies: validatedArguments.dependencies as string[],
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
        const agents = await storage.getAgents(validatedArguments.agent as string);
        const tasks = await storage.getTasks(validatedArguments.agent as string);

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
        const agentId = (validatedArguments.agent as string) ?? `agent-${Date.now()}`;
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
          from: validatedArguments.from as string,
          to: validatedArguments.to as string,
          type: MessageType.SYNC_REQUEST,
          content: validatedArguments.topic as string,
          timestamp: Date.now(),
          read: false,
          priority: MessagePriority.URGENT,
        };

        await storage.saveMessage(syncMessage);

        const timeout = (validatedArguments.timeout as number) ?? 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          await new Promise(resolve => {
            setTimeout(resolve, 1000);
          });

          const responses = await storage.getMessages({
            agent: validatedArguments.from as string,
            since: syncMessage.timestamp,
          });

          const response = responses.find(
            m => m.from === validatedArguments.to && m.threadId === syncMessage.id,
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
