/* eslint-disable @vitest/no-conditional-expect */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

async function parseSSEResponse(response: Response): Promise<any> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: any = null;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          if (data) {
            try {
              const parsed = JSON.parse(data);

              // Look for the actual result, not just any data
              if (parsed.result) {
                result = parsed;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // If we have a result, we can break early
      if (result) {
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

describe('Agent Hub MCP HTTP Transport E2E Tests', () => {
  let testDataDirectory: string;
  let serverProcess: any;
  let baseUrl: string;

  beforeAll(async () => {
    // Setup test environment
    testDataDirectory = path.join(__dirname, '..', '..', '.agent-hub-e2e-http-test');

    // Remove any existing test data directory
    if (fs.existsSync(testDataDirectory)) {
      fs.rmSync(testDataDirectory, { recursive: true, force: true });
    }

    // Create fresh test data directory
    fs.mkdirSync(testDataDirectory, { recursive: true });

    // Start HTTP server
    baseUrl = 'http://localhost:3738'; // Use different port to avoid conflicts
    const { spawn } = await import('node:child_process');
    const serverPath = path.join(__dirname, '..', '..', 'dist', 'index-http.js');

    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        AGENT_HUB_DATA_DIR: testDataDirectory,
        PORT: '3738',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.on('error', (error: Error) => {
      // Only log critical spawn errors
      throw error;
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within 15 seconds'));
      }, 15000);

      const checkServer = async () => {
        try {
          const response = await fetch(`${baseUrl}/ping`);

          if (response.ok) {
            clearTimeout(timeout);
            resolve(true);
          } else {
            setTimeout(checkServer, 100);
          }
        } catch {
          setTimeout(checkServer, 100);
        }
      };

      checkServer();
    });
  });

  afterAll(async () => {
    // Cleanup server
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      // Wait for graceful shutdown
      await new Promise(resolve => {
        serverProcess.on('exit', resolve);
        setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve(true);
        }, 5000);
      });
    }

    // Remove test data directory
    if (fs.existsSync(testDataDirectory)) {
      fs.rmSync(testDataDirectory, { recursive: true, force: true });
    }
  });

  let sessionId: string | null = null;

  async function initializeSession() {
    const initResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: {
            name: 'http-e2e-test',
            version: '1.0.0',
          },
        },
      }),
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();

      throw new Error(`HTTP initialization failed! status: ${initResponse.status} - ${errorText}`);
    }

    sessionId = initResponse.headers.get('mcp-session-id');

    if (!sessionId) {
      throw new Error('No session ID returned from server');
    }

    // Parse the initialization response to consume the stream
    await parseSSEResponse(initResponse);

    // Send initialized notification
    await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });
  }

  async function callTool(name: string, arguments_: Record<string, any> = {}) {
    if (!sessionId) {
      await initializeSession();
    }

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: arguments_,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Parse SSE stream response
    const result = await parseSSEResponse(response);

    if (result?.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }

    const content = result?.result?.content;

    return content?.[0]?.text ? JSON.parse(content[0].text) : content;
  }

  describe('Agent Registration via HTTP', () => {
    it('should register a new agent successfully', async () => {
      const result = await callTool('register_agent', {
        id: 'http-test-agent',
        projectPath: '/Users/test/http-project',
        role: 'HTTP Test Agent',
        capabilities: ['http-testing'],
      });

      expect(result).toMatchObject({
        success: true,
        agent: {
          id: 'http-test-agent',
          projectPath: '/Users/test/http-project',
          role: 'HTTP Test Agent',
          capabilities: ['http-testing'],
        },
        reconnected: false,
      });
    });

    it('should get hub status via HTTP', async () => {
      const result = await callTool('get_hub_status');

      expect(result.agents.total).toBe(1);
      expect(result.agents.active).toHaveLength(1);
      expect(result.agents.active[0]).toMatchObject({
        id: 'http-test-agent',
        projectPath: '/Users/test/http-project',
        status: 'active',
      });
    });
  });

  describe('Messaging via HTTP', () => {
    it('should send and retrieve messages via HTTP', async () => {
      // Send a message
      const sendResult = await callTool('send_message', {
        from: 'http-client',
        to: 'http-test-agent',
        type: 'context',
        content: 'Hello from HTTP transport test!',
        priority: 'normal',
      });

      expect(sendResult).toMatchObject({
        success: true,
        messageId: expect.any(String),
      });

      // Retrieve messages
      const getResult = await callTool('get_messages', {
        agent: 'http-test-agent',
      });

      expect(getResult.messages).toHaveLength(1);
      expect(getResult.messages[0]).toMatchObject({
        from: 'http-client',
        to: 'http-test-agent',
        type: 'context',
        content: 'Hello from HTTP transport test!',
        priority: 'normal',
        read: false, // Messages start as unread by default
        timestamp: expect.any(Number),
        id: expect.any(String),
      });
    });
  });

  describe('Feature Collaboration via HTTP', () => {
    it('should create and manage features via HTTP', async () => {
      // Create a feature
      const featureResult = await callTool('create_feature', {
        name: 'http-test-feature',
        title: 'HTTP Test Feature',
        description: 'A test feature for HTTP transport',
        priority: 'normal',
        createdBy: 'http-test-agent',
      });

      expect(featureResult).toMatchObject({
        success: true,
        feature: {
          id: 'http-test-feature',
          title: 'HTTP Test Feature',
          description: 'A test feature for HTTP transport',
          priority: 'normal',
          status: 'planning',
          createdBy: 'http-test-agent',
        },
      });

      // Create task with delegation
      const taskResult = await callTool('create_task', {
        featureId: 'http-test-feature',
        title: 'HTTP Test Task',
        description: 'A test task via HTTP',
        delegations: [
          {
            agent: 'http-test-agent',
            scope: 'Handle HTTP implementation',
          },
        ],
        createdBy: 'http-test-agent',
      });

      expect(taskResult).toMatchObject({
        success: true,
        task: {
          title: 'HTTP Test Task',
          description: 'A test task via HTTP',
        },
      });

      // Get feature details
      const feature = await callTool('get_feature', { featureId: 'http-test-feature' });
      const delegationId = feature.delegations?.[0]?.id;

      if (delegationId) {
        // Accept delegation
        const acceptResult = await callTool('accept_delegation', {
          featureId: 'http-test-feature',
          delegationId,
          agentId: 'http-test-agent',
        });

        expect(acceptResult).toMatchObject({
          success: true,
        });

        // Create subtasks
        const subtaskResult = await callTool('create_subtask', {
          featureId: 'http-test-feature',
          delegationId,
          subtasks: [
            {
              title: 'Setup HTTP endpoints',
              description: 'Create REST API endpoints',
            },
          ],
          createdBy: 'http-test-agent',
        });

        expect(subtaskResult).toMatchObject({
          success: true,
          subtasks: expect.arrayContaining([
            expect.objectContaining({
              title: 'Setup HTTP endpoints',
              status: 'todo',
            }),
          ]),
        });

        // Update subtask
        if (subtaskResult.subtasks?.length > 0) {
          const subtaskId = subtaskResult.subtasks[0].id;
          const updateResult = await callTool('update_subtask', {
            featureId: 'http-test-feature',
            subtaskId,
            status: 'in-progress',
            output: 'Started HTTP endpoint implementation',
            updatedBy: 'http-test-agent',
          });

          expect(updateResult).toMatchObject({
            success: true,
          });
        }
      }
    });

    it('should track agent workload via HTTP', async () => {
      const workloadResult = await callTool('get_agent_workload', {
        agentId: 'http-test-agent',
      });

      expect(workloadResult.success).toBe(true);
      expect(workloadResult.workload).toBeDefined();
    });
  });
});
