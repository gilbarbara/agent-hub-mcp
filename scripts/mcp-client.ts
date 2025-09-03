/* eslint-disable no-console */

/**
 * MCP Client Script for Agent Hub
 *
 * This script demonstrates how to connect to the Agent Hub MCP server.
 */

import path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class AgentHubClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async initialize(): Promise<boolean> {
    console.log('🚀 Initializing Agent Hub MCP Client...');

    // Path to the built MCP server
    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

    try {
      // Create stdio transport to connect to the MCP server
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [serverPath],
        env: process.env as Record<string, string>,
      });

      // Create MCP client
      this.client = new Client(
        {
          name: 'agent-hub-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );

      // Connect to the server
      await this.client.connect(this.transport);
      console.log('✅  Connected to Agent Hub MCP server');

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MCP client:', (error as Error).message);

      return false;
    }
  }

  async callTool(name: string, arguments_: Record<string, any> = {}): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      console.log(`🔧 Calling tool: ${name}`);
      console.log(JSON.stringify(arguments_, null, 2));
      const result = await this.client.callTool({ name, arguments: arguments_ });

      console.log('📦 Result:');
      const content = result.content as Array<{ text?: string }>;
      const parsed = content[0]?.text ? JSON.parse(content[0].text) : content;

      console.log(parsed);

      return parsed;
    } catch (error) {
      console.error(`❌ Tool ${name} failed:`, (error as Error).message);

      return null;
    }
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');

    if (this.client) {
      await this.client.close();
    }

    if (this.transport) {
      await this.transport.close();
    }

    console.log('✅ Cleanup completed');
  }
}

// Run the tests
async function main(): Promise<void> {
  const client = new AgentHubClient();

  await client.initialize();

  const agent1 = await client.callTool('register_agent', {
    id: 'test-agent',
    projectPath: '/Users/test/project-a',
    role: 'Test Agent',
    capabilities: ['testing'],
  });

  if (agent1?.success) {
    console.log(`✅ Agent registered: ${agent1.agent.id}`);
    console.log(`📁Project Path: ${agent1.agent.projectPath}`);
  }

  await client.cleanup();
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
})();
