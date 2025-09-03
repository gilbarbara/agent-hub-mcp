/* eslint-disable no-console */

import { AgentService } from './agents/service';
import { FeaturesService } from './features/service';
import { MessageService } from './messaging/service';
import { createHttpServer } from './servers/http';
import { FileStorage } from './storage';

// Use FileStorage directly for simplicity and reliability
function createStorage(): FileStorage {
  const dataDirectory = process.env.AGENT_HUB_DATA_DIR ?? '~/.agent-hub';

  return new FileStorage(dataDirectory);
}

async function main() {
  // Initialize storage
  const storage = createStorage();

  await storage.init();

  // Initialize services
  const messageService = new MessageService(storage);
  const featuresService = new FeaturesService(storage);
  const agentService = new AgentService(storage, featuresService, messageService);

  // Create HTTP server with all dependencies
  const app = createHttpServer({
    storage,
    messageService,
    agentService,
  });

  // Start server
  const port = process.env.PORT ?? 3737;

  app.listen(port, () => {
    console.log(`🚀 Agent Hub MCP HTTP Server listening on port ${port}`);
    console.log(`📡 SSE notifications enabled`);
    console.log(`🔗 Connect via: http://localhost:${port}/mcp`);
  });
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});
