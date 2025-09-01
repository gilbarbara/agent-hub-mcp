/* eslint-disable no-console */

import { ContextService } from './context/service';
import { MessageService } from './messaging/service';
import { createHttpServer } from './servers/http';
import { FileStorage, IndexedStorage, StorageAdapter } from './storage';
import { TaskService } from './tasks/service';

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

async function main() {
  // Initialize storage
  const storage = createStorage();

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
