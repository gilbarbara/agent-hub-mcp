/* eslint-disable no-console */

import { ContextService } from './context/service.js';
import { MessageService } from './messaging/service.js';
import { createHttpServer } from './servers/http.js';
import { FileStorage } from './storage.js';
import { TaskService } from './tasks/service.js';

async function main() {
  // Initialize storage
  const storage = new FileStorage(process.env.AGENT_HUB_DATA_DIR || '~/.agent-hub');

  await storage.init();

  // Initialize services
  const messageService = new MessageService(storage);
  const contextService = new ContextService(storage);
  const taskService = new TaskService(storage);

  // Create HTTP server with all dependencies
  const app = createHttpServer({
    storage,
    messageService,
    contextService,
    taskService,
  });

  // Start server
  const port = process.env.PORT || 3737;

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
