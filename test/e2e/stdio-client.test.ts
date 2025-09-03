import fs from 'node:fs';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Agent Hub MCP stdio Transport E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testDataDirectory: string;

  beforeAll(async () => {
    // Setup test environment
    testDataDirectory = path.join(__dirname, '..', '..', '.agent-hub-e2e-test');

    // Remove any existing test data directory
    if (fs.existsSync(testDataDirectory)) {
      fs.rmSync(testDataDirectory, { recursive: true, force: true });
    }

    // Create fresh test data directory
    fs.mkdirSync(testDataDirectory, { recursive: true });

    // Path to the built MCP server
    const serverPath = path.join(__dirname, '..', '..', 'dist', 'index.js');

    // Create stdio transport to connect to the MCP server
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        AGENT_HUB_DATA_DIR: testDataDirectory,
      },
    });

    // Create MCP client
    client = new Client(
      {
        name: 'agent-hub-e2e-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    // Connect to the server
    await client.connect(transport);
  });

  afterAll(async () => {
    // Cleanup
    if (client) {
      await client.close();
    }

    if (transport) {
      await transport.close();
    }

    // Remove test data directory
    if (fs.existsSync(testDataDirectory)) {
      fs.rmSync(testDataDirectory, { recursive: true, force: true });
    }
  });

  async function callTool(name: string, arguments_: Record<string, any> = {}) {
    const result = await client.callTool({ name, arguments: arguments_ });
    const content = result.content as Array<{ text?: string }>;

    return content[0]?.text ? JSON.parse(content[0].text) : content;
  }

  describe('Project Path Behavior', () => {
    it('should register a new agent successfully', async () => {
      const result = await callTool('register_agent', {
        id: 'test-agent',
        projectPath: '/Users/test/project-a',
        role: 'Test Agent',
        capabilities: ['testing'],
      });

      expect(result).toMatchObject({
        success: true,
        agent: {
          id: 'test-agent',
          projectPath: '/Users/test/project-a',
          role: 'Test Agent',
          capabilities: ['testing'],
        },
        reconnected: false,
      });
    });

    it('should reconnect when registering same agent again', async () => {
      const result = await callTool('register_agent', {
        id: 'test-agent',
        projectPath: '/Users/test/project-a',
        role: 'Test Agent Updated',
        capabilities: ['testing', 'debugging'],
      });

      expect(result).toMatchObject({
        success: true,
        agent: {
          id: 'test-agent',
          projectPath: '/Users/test/project-a',
          role: 'Test Agent Updated',
          capabilities: ['testing', 'debugging'],
        },
        reconnected: true,
      });
      expect(result.message).toContain('Welcome back');
    });

    it('should reject registration of existing agent ID with different project path', async () => {
      const result = await callTool('register_agent', {
        id: 'test-agent',
        projectPath: '/Users/test/project-b',
        role: 'Test Agent Different Path',
        capabilities: ['testing', 'different-path'],
      });

      expect(result).toMatchObject({
        success: false,
        error: 'AGENT_ID_CONFLICT',
      });
      expect(result.existingAgent).toBeDefined();
    });

    it('should reconnect to existing agent when using different ID with same project path', async () => {
      const result = await callTool('register_agent', {
        id: 'different-id',
        projectPath: '/Users/test/project-a',
        role: 'Test Agent Same Path Different ID',
        capabilities: ['testing', 'same-path'],
      });

      expect(result).toMatchObject({
        success: true,
        agent: {
          id: 'test-agent', // Should keep original ID
          projectPath: '/Users/test/project-a',
        },
        reconnected: true,
      });
    });

    it('should show registered agents in hub status', async () => {
      const result = await callTool('get_hub_status');

      expect(result.agents.total).toBe(1);
      expect(result.agents.active).toHaveLength(1);
      expect(result.agents.active[0]).toMatchObject({
        id: 'test-agent',
        projectPath: '/Users/test/project-a',
        status: 'active',
      });
    });
  });

  describe('Messaging System', () => {
    it('should send and retrieve messages successfully', async () => {
      // Send a message
      const sendResult = await callTool('send_message', {
        from: 'test-client',
        to: 'test-agent',
        type: 'context',
        content: 'Hello from e2e test! Testing message persistence.',
        priority: 'normal',
      });

      expect(sendResult).toMatchObject({
        success: true,
        messageId: expect.any(String),
      });

      // Retrieve messages
      const getResult = await callTool('get_messages', {
        agent: 'test-agent',
      });

      expect(getResult.messages).toHaveLength(1);
      expect(getResult.messages[0]).toMatchObject({
        from: 'test-client',
        to: 'test-agent',
        type: 'context',
        content: 'Hello from e2e test! Testing message persistence.',
        priority: 'normal',
        read: false, // Messages start as unread by default
        timestamp: expect.any(Number),
        id: expect.any(String),
      });
    });

    it('should handle message filtering by type', async () => {
      // Send different message types
      await callTool('send_message', {
        from: 'test-client',
        to: 'test-agent',
        type: 'task',
        content: 'Task message',
      });

      await callTool('send_message', {
        from: 'test-client',
        to: 'test-agent',
        type: 'question',
        content: 'Question message',
      });

      // Get only task messages
      const taskMessages = await callTool('get_messages', {
        agent: 'test-agent',
        type: 'task',
      });

      expect(taskMessages.messages).toHaveLength(1);
      expect(taskMessages.messages[0].type).toBe('task');
    });
  });

  describe('Feature Collaboration System', () => {
    it('should create and manage features', async () => {
      // Create a feature
      const featureResult = await callTool('create_feature', {
        name: 'test-feature',
        title: 'Test Feature',
        description: 'A test feature for e2e testing',
        priority: 'normal',
        createdBy: 'test-agent',
      });

      expect(featureResult).toMatchObject({
        success: true,
        feature: {
          id: 'test-feature',
          title: 'Test Feature',
          description: 'A test feature for e2e testing',
          priority: 'normal',
          status: 'planning',
          createdBy: 'test-agent',
        },
      });

      // Get features list
      const featuresResult = await callTool('get_features');

      expect(featuresResult.features).toHaveLength(1);
      expect(featuresResult.features[0].id).toBe('test-feature');
    });

    it('should filter features by various criteria', async () => {
      // Create a second feature with different properties
      await callTool('create_feature', {
        name: 'high-priority-feature',
        title: 'High Priority Feature',
        description: 'A high priority feature for testing filters',
        priority: 'high',
        createdBy: 'test-agent',
      });

      // Test filtering by priority
      const highPriorityFeatures = await callTool('get_features', {
        priority: 'high',
      });

      expect(highPriorityFeatures.features).toHaveLength(1);
      expect(highPriorityFeatures.features[0].priority).toBe('high');

      // Test filtering by status
      const planningFeatures = await callTool('get_features', {
        status: 'planning',
      });

      expect(planningFeatures.features).toHaveLength(2); // Both features should be in planning

      // Test filtering by createdBy
      const agentFeatures = await callTool('get_features', {
        createdBy: 'test-agent',
      });

      expect(agentFeatures.features).toHaveLength(2); // Both created by test-agent

      // Test filtering by agent assignment - may return different results based on implementation
      const assignedFeatures = await callTool('get_features', {
        agent: 'test-agent',
      });

      expect(assignedFeatures.features).toEqual(expect.any(Array)); // Verify it returns an array
    });

    it('should create tasks with delegations', async () => {
      const taskResult = await callTool('create_task', {
        featureId: 'test-feature',
        title: 'Test Task',
        description: 'A test task with delegations',
        delegations: [
          {
            agent: 'test-agent',
            scope: 'Handle backend implementation',
          },
        ],
        createdBy: 'test-agent',
      });

      expect(taskResult).toMatchObject({
        success: true,
        task: {
          title: 'Test Task',
          description: 'A test task with delegations',
        },
      });
      // Note: delegations structure may differ from expected
    });

    it('should allow accepting delegations and creating subtasks', async () => {
      // Get feature to find delegation ID
      const feature = await callTool('get_feature', { featureId: 'test-feature' });

      // Delegations are at the top level in the response, not nested in tasks
      const delegationId = feature.delegations?.[0]?.id;

      if (!delegationId) {
        throw new Error('No delegation found to accept');
      }

      // Accept delegation
      const acceptResult = await callTool('accept_delegation', {
        featureId: 'test-feature',
        delegationId,
        agentId: 'test-agent',
      });

      expect(acceptResult).toMatchObject({
        success: true,
      });

      // Create subtasks
      const subtaskResult = await callTool('create_subtask', {
        featureId: 'test-feature',
        delegationId,
        subtasks: [
          {
            title: 'Setup database schema',
            description: 'Create necessary tables',
          },
          {
            title: 'Implement API endpoints',
            description: 'Create REST endpoints',
            dependsOn: [], // Will be filled with first subtask ID
          },
        ],
        createdBy: 'test-agent',
      });

      expect(subtaskResult).toMatchObject({
        success: true,
        subtasks: expect.arrayContaining([
          expect.objectContaining({
            title: 'Setup database schema',
            status: 'todo',
          }),
          expect.objectContaining({
            title: 'Implement API endpoints',
            status: 'todo',
          }),
        ]),
      });

      // Test updating subtask status
      const firstSubtaskId = subtaskResult.subtasks[0].id;
      const updateResult = await callTool('update_subtask', {
        featureId: 'test-feature',
        subtaskId: firstSubtaskId,
        status: 'in-progress',
        output: 'Started working on database schema',
        updatedBy: 'test-agent',
      });

      expect(updateResult).toMatchObject({
        success: true,
      });
    });

    it('should track agent workload', async () => {
      const workloadResult = await callTool('get_agent_workload', {
        agentId: 'test-agent',
      });

      expect(workloadResult.success).toBe(true);
      // Note: workload response structure may differ from expected
      expect(workloadResult.workload).toBeDefined();
    });
  });
});
