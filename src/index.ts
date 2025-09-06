#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { AgentService } from './agents/service';
import { FeaturesService } from './features/service';
import { MessageService } from './messaging/service';
import { createMcpServer } from './servers/mcp';
import { FileStorage } from './storage';

// Use FileStorage directly for simplicity and reliability
function createStorage(): FileStorage {
  const dataDirectory = process.env.AGENT_HUB_DATA_DIR ?? '~/.agent-hub';

  return new FileStorage(dataDirectory);
}

const storage = createStorage();

// Initialize services
const messageService = new MessageService(storage);
const featuresService = new FeaturesService(storage);
const agentService = new AgentService(storage, featuresService, messageService);

async function main() {
  await storage.init();

  // For stdio transport, we have a single server instance
  let mcpServer: any = null;

  // Notification functions for stdio transport
  async function broadcastNotification(method: string, _params: any) {
    if (mcpServer) {
      // eslint-disable-next-line no-console
      console.error(`📡 Broadcasting ${method} via stdio transport`);

      try {
        // Use MCP's built-in resource list changed notification
        await mcpServer.sendResourceListChanged();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error sending notification via stdio:', error);
      }
    }
  }

  async function sendNotificationToAgent(agentId: string, method: string, _params: any) {
    if (mcpServer) {
      // eslint-disable-next-line no-console
      console.error(`📤 Sending ${method} to agent ${agentId} via stdio transport`);

      try {
        // For stdio, we send to the single connected client
        await mcpServer.sendResourceListChanged();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error sending notification to agent via stdio:', error);
      }
    }
  }

  async function sendResourceNotification(agentId: string, resourceUri: string) {
    if (mcpServer) {
      // eslint-disable-next-line no-console
      console.error(
        `🔄 Sending resource notification to ${agentId} for ${resourceUri} via stdio transport`,
      );

      try {
        // For stdio, we send resources/list_changed to the single connected client
        // The client should then re-read all resources including the changed one
        await mcpServer.sendResourceListChanged();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error sending resource notification via stdio:', error);
      }
    }
  }

  // Create MCP server with proper notification handlers
  const server = createMcpServer({
    storage,
    messageService,
    agentService,
    broadcastNotification,
    getCurrentSession: () => undefined, // No session management for stdio
    sendNotificationToAgent,
    sendResourceNotification,
  });

  mcpServer = server;

  const transport = new StdioServerTransport();

  await server.connect(transport);

  // eslint-disable-next-line no-console
  console.error(`Agent Hub MCP server started`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch(error => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
