#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { AgentService } from './agents/service';
import { FeaturesService } from './features/service';
import { MessageService } from './messaging/service';
import { createMcpServer } from './servers/mcp';
import { FileStorage, IndexedStorage, StorageAdapter } from './storage';

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

// Initialize services
const messageService = new MessageService(storage);
const featuresService = new FeaturesService(storage);
const agentService = new AgentService(storage, featuresService, messageService);

async function main() {
  await storage.init();

  // Create MCP server with all the services
  const server = createMcpServer({
    storage,
    messageService,
    agentService,
    broadcastNotification: async () => {}, // No-op for stdio transport
    getCurrentSession: () => undefined,
    sendNotificationToAgent: async () => {}, // No-op for stdio transport
  });

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
