import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentService } from '~/agents/service';
import { FeaturesService } from '~/features/service';
import { MessageService } from '~/messaging/service';
import { FileStorage } from '~/storage';
import { createToolHandlers, ToolHandlerServices } from '~/tools/handlers';

import { AgentRegistration, Message, MessagePriority, MessageType } from '~/types';

// Mock createId to make tests deterministic but unique
vi.mock('@paralleldrive/cuid2', () => {
  let counter = 0;

  return {
    createId: vi.fn(() => `mock-id-${++counter}`),
  };
});

describe('Multi-Agent Integration Tests', () => {
  let storage: FileStorage;
  let messageService: MessageService;
  let featuresService: FeaturesService;
  let agentService: AgentService;
  let toolHandlers: any;

  // Mock agent sessions
  const frontendAgent: AgentRegistration = {
    id: 'frontend-agent',
    projectPath: '/Users/test/frontend',
    role: 'Frontend Developer',
    capabilities: ['react', 'typescript', 'ui'],
    status: 'active',
    lastSeen: Date.now(),
    collaboratesWith: ['backend-agent'],
  };

  const backendAgent: AgentRegistration = {
    id: 'backend-agent',
    projectPath: '/Users/test/backend',
    role: 'Backend Developer',
    capabilities: ['node', 'database', 'api'],
    status: 'active',
    lastSeen: Date.now(),
    collaboratesWith: ['frontend-agent'],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock console output to prevent bleeding
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create real services with temporary directory
    storage = new FileStorage(`/tmp/agent-hub-test-${Date.now()}`);
    await storage.init();

    messageService = new MessageService(storage);
    featuresService = new FeaturesService(storage);
    agentService = new AgentService(storage, featuresService, messageService);

    // Mock session for testing
    const mockSession = {
      agent: frontendAgent,
    } as any; // Mock session for testing

    const services: ToolHandlerServices = {
      storage,
      messageService,
      agentService,
      getCurrentSession: () => mockSession,
      broadcastNotification: vi.fn().mockResolvedValue(undefined),
      sendNotificationToAgent: vi.fn().mockResolvedValue(undefined),
      sendResourceNotification: vi.fn().mockResolvedValue(undefined),
    };

    toolHandlers = createToolHandlers(services);

    // Register test agents
    await storage.saveAgent(frontendAgent);
    await storage.saveAgent(backendAgent);
  });

  describe('Agent Registration and Discovery', () => {
    it('should register multiple agents and discover collaborators', async () => {
      // Register a new mobile agent
      const registerResult = await toolHandlers.register_agent({
        id: 'mobile',
        projectPath: '/Users/test/mobile',
        role: 'Mobile Developer',
        capabilities: ['react-native', 'ios', 'android'],
        collaboratesWith: ['backend-agent'],
      });

      expect(registerResult.success).toBe(true);
      expect(registerResult.agent.id).toBe('mobile');

      // Get hub status to verify registration
      const statusResult = await toolHandlers.get_hub_status({});

      expect(statusResult.agents.total).toBe(3); // frontend, backend, mobile
      expect(statusResult.agents.active.some((a: any) => a.id === 'mobile')).toBe(true);
    });

    it('should discover active agents for collaboration', async () => {
      const collaborationResult = await toolHandlers.create_feature({
        name: 'user-authentication',
        title: 'User Authentication System',
        description: 'Implement login and registration functionality',
        createdBy: 'product-manager',
        estimatedAgents: ['frontend-agent', 'backend-agent'],
      });

      expect(collaborationResult.success).toBe(true);
      expect(collaborationResult.feature).toBeDefined();
      expect(collaborationResult.feature.id).toBe('user-authentication');
    });
  });

  describe('Cross-Agent Communication', () => {
    it('should facilitate message exchange between agents', async () => {
      // Frontend agent sends API requirements to backend
      const sendResult = await toolHandlers.send_message({
        from: 'frontend-agent',
        to: 'backend-agent',
        type: MessageType.TASK,
        content: 'Need user authentication API with JWT tokens',
        metadata: {
          priority: 'high',
          deadline: '2024-01-15',
          endpoints: ['/auth/login', '/auth/register'],
        },
      });

      expect(sendResult.messageId).toBeDefined();

      // Backend agent retrieves messages
      const getResult = await toolHandlers.get_messages({
        agent: 'backend-agent',
        markAsRead: false,
      });

      expect(getResult.count).toBe(1);
      expect(getResult.messages[0].content).toContain('authentication API');
      expect(getResult.messages[0].metadata.endpoints).toEqual(['/auth/login', '/auth/register']);

      // Backend agent responds with API specification
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'frontend-agent',
        type: MessageType.COMPLETION,
        content: 'Authentication API ready - see shared context for OpenAPI spec',
        threadId: getResult.messages[0].id,
      });

      // Verify bi-directional communication
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-agent',
        markAsRead: false,
      });

      expect(frontendMessages.count).toBe(1);
      expect(frontendMessages.messages[0].content).toContain('OpenAPI spec');
    });

    it('should handle broadcast messages to all agents', async () => {
      // System broadcast about maintenance
      await toolHandlers.send_message({
        from: 'system',
        to: 'all',
        type: MessageType.CONTEXT,
        content: 'Scheduled maintenance at 2 AM - all deployments on hold',
        priority: MessagePriority.URGENT,
      });

      // All agents should receive the broadcast
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-agent',
        markAsRead: false,
      });

      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-agent',
        markAsRead: false,
      });

      expect(frontendMessages.count).toBe(1);
      expect(backendMessages.count).toBe(1);
      expect(frontendMessages.messages[0].content).toContain('maintenance');
      expect(backendMessages.messages[0].content).toContain('maintenance');
    });
  });

  describe('Task Coordination', () => {
    it('should coordinate feature development across agents', async () => {
      // Frontend announces UI task start
      await toolHandlers.send_message({
        from: 'frontend-agent',
        to: 'all',
        type: 'task',
        content:
          'Started: Build user authentication UI - Creating login and registration forms (depends on api:user-auth)',
        metadata: { task: 'ui-auth', status: 'started', dependencies: ['api:user-auth'] },
      });

      // Backend announces API task progress
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'all',
        type: 'task',
        content:
          'In Progress: Implement authentication endpoints - JWT token generation and validation (depends on database:user-schema)',
        metadata: {
          task: 'api-auth',
          status: 'in-progress',
          dependencies: ['database:user-schema'],
        },
      });

      // Verify task coordination via messages
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-agent',
        markAsRead: false,
      });
      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-agent',
        markAsRead: false,
      });

      expect(frontendMessages.count).toBe(2); // Sent frontend message + received backend message
      expect(backendMessages.count).toBe(2); // Sent backend message + received frontend message
      expect(
        frontendMessages.messages.some((m: Message) =>
          m.content.includes('Started: Build user authentication UI'),
        ),
      ).toBe(true);
      expect(
        backendMessages.messages.some((m: Message) =>
          m.content.includes('In Progress: Implement authentication endpoints'),
        ),
      ).toBe(true);
    });

    it('should track task completion and notify dependent agents', async () => {
      // Backend completes API task and announces completion
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'all',
        type: 'completion',
        content:
          'Completed: Authentication API implementation - All endpoints tested and deployed to staging',
        metadata: { task: 'api-auth', status: 'completed' },
      });

      // Send notification to dependent agents
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'frontend-agent',
        type: MessageType.COMPLETION,
        content: 'Authentication API is ready for integration - staging URL in shared context',
        metadata: {
          task: 'Authentication API implementation',
          status: 'completed',
          stagingUrl: 'https://api-staging.company.com',
        },
      });

      // Frontend acknowledges and starts integration
      await toolHandlers.send_message({
        from: 'frontend-agent',
        to: 'backend-agent',
        type: 'task',
        content:
          'Started: Integrate with authentication API - Using staging URL for development integration',
        metadata: { task: 'ui-integration', status: 'started', dependencies: ['api-auth'] },
      });

      const messages = await toolHandlers.get_messages({
        agent: 'frontend-agent',
        markAsRead: false,
      });

      expect(messages.count).toBe(2); // Received completion from backend + sent integration start message
      expect(
        messages.messages.some((m: Message) =>
          m.content.includes('Completed: Authentication API implementation'),
        ),
      ).toBe(true);
      expect(messages.messages.some((m: Message) => m.metadata?.task === 'api-auth')).toBe(true);
      expect(
        messages.messages.some(
          (m: Message) => m.metadata?.stagingUrl === 'https://api-staging.company.com',
        ),
      ).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle agent disconnection gracefully', async () => {
      // Simulate agent going offline
      const offlineAgent: AgentRegistration = {
        ...backendAgent,
        status: 'offline',
        lastSeen: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      };

      await storage.saveAgent(offlineAgent);

      // Test hub status instead of collaboration
      const statusResult = await toolHandlers.get_hub_status({});

      expect(statusResult.agents.active.some((a: any) => a.id.includes('backend'))).toBe(false); // Backend offline
      expect(statusResult.agents.active.some((a: any) => a.id.includes('frontend'))).toBe(true); // Frontend still active
    });

    it('should handle message delivery to offline agents', async () => {
      // Send message to offline agent
      await toolHandlers.send_message({
        from: 'frontend-agent',
        to: 'offline-agent',
        type: MessageType.QUESTION,
        content: 'When will the user service be available?',
      });

      // Message should be stored for later retrieval
      const messages = await toolHandlers.get_messages({
        agent: 'offline-agent',
        markAsRead: false,
      });

      expect(messages.count).toBe(1);
      expect(messages.messages[0].content).toContain('user service');
    });
  });

  describe('Complex Multi-Agent Workflows', () => {
    it('should coordinate full-stack feature development', async () => {
      // 1. Product manager defines requirements via message
      await toolHandlers.send_message({
        from: 'product-manager',
        to: 'all',
        type: 'context',
        content:
          'Feature requirements for user profiles: Users can upload profile pictures, set privacy preferences, and connect social accounts. Acceptance criteria: Image upload with validation, privacy toggle, OAuth integration.',
      });

      // 2. Backend agent starts database design
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'all',
        type: 'task',
        content:
          'Started: Design user profiles database schema - Creating tables for profiles, images, and social connections',
        metadata: { task: 'db-schema', status: 'started' },
      });

      // 3. Frontend agent starts UI mockups
      await toolHandlers.send_message({
        from: 'frontend-agent',
        to: 'all',
        type: 'task',
        content:
          'Started: Create user profile UI mockups - Designing profile page with image upload component',
        metadata: { task: 'ui-mockups', status: 'started' },
      });

      // 4. Backend completes schema and notifies frontend
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'all',
        type: 'completion',
        content:
          'Completed: Design user profiles database schema - Schema includes users, profiles, images, and social_accounts tables',
        metadata: { task: 'db-schema', status: 'completed' },
      });

      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'frontend-agent',
        type: MessageType.CONTEXT,
        content: 'Database schema is ready - check shared context for API specifications',
      });

      // 5. Backend shares API specification via message
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'frontend-agent',
        type: 'context',
        content:
          'API specification ready: GET /api/users/{id}/profile, PUT /api/users/{id}/profile, POST /api/users/{id}/profile/image, POST /api/users/{id}/social. Profile model includes id, userId, displayName, bio, imageUrl, privacy (public|private), socialAccounts array.',
      });

      // 6. Frontend integrates with API
      await toolHandlers.send_message({
        from: 'frontend-agent',
        to: 'all',
        type: 'task',
        content:
          'In Progress: Implement profile page integration - Connecting UI components to backend API',
        metadata: {
          task: 'profile-integration',
          status: 'in-progress',
          dependencies: ['db-schema'],
        },
      });

      // Verify the complete workflow via messages
      const messages = await toolHandlers.get_messages({
        agent: 'frontend-agent',
        markAsRead: false,
      });

      // Verify message-based coordination instead of task status
      expect(messages.count).toBe(7); // requirements, backend tasks, API spec, and frontend integration (all broadcasted to 'all')
      expect(messages.messages.some((m: Message) => m.content.includes('schema is ready'))).toBe(
        true,
      );
      expect(
        messages.messages.some((m: Message) => m.content.includes('API specification ready')),
      ).toBe(true);
    });

    it('should handle crisis communication during outages', async () => {
      // DevOps broadcasts emergency alert
      await toolHandlers.send_message({
        from: 'devops-agent',
        to: 'all',
        type: MessageType.ERROR,
        content: 'Database connection pool exhausted - investigating',
        priority: MessagePriority.URGENT,
        metadata: {
          incident: 'DB-2024-001',
          severity: 'critical',
          affectedServices: ['authentication', 'user-profiles', 'notifications'],
        },
      });

      // All agents acknowledge and report status
      await toolHandlers.send_message({
        from: 'backend-agent',
        to: 'devops-agent',
        type: MessageType.CONTEXT,
        content: 'Backend services switched to read-only mode',
        metadata: { incident: 'DB-2024-001' },
      });

      await toolHandlers.send_message({
        from: 'frontend-agent',
        to: 'devops-agent',
        type: MessageType.CONTEXT,
        content: 'Frontend displaying maintenance banner to users',
        metadata: { incident: 'DB-2024-001' },
      });

      // DevOps shares resolution update via message
      await toolHandlers.send_message({
        from: 'devops-agent',
        to: 'all',
        type: 'context',
        content:
          'Incident DB-2024-001 update - Status: investigating. Timeline: 14:32 Connection pool exhausted, 14:35 Read-only mode activated, 14:38 User notification displayed. ETA for resolution: 15:00',
        metadata: { incident: 'DB-2024-001' },
      });

      // Verify crisis communication flow
      const devopsMessages = await toolHandlers.get_messages({
        agent: 'devops-agent',
        markAsRead: false,
      });

      expect(devopsMessages.count).toBe(4); // Updated: emergency alert + incident update + responses from backend and frontend
      expect(
        devopsMessages.messages.some((m: Message) => m.content.includes('investigating')),
      ).toBe(true);
      expect(devopsMessages.messages.some((m: Message) => m.content.includes('15:00'))).toBe(true);
    });
  });

  describe('Advanced Edge Cases and Stress Tests', () => {
    it('should handle rapid-fire message exchange between multiple agents', async () => {
      const messageCount = 50;
      const agents = ['agent-alpha', 'agent-beta', 'agent-gamma', 'agent-delta'];

      // Register all test agents
      await Promise.all(
        agents.map(id =>
          storage.saveAgent({
            id,
            projectPath: `/test/${id}`,
            role: `Test ${id}`,
            capabilities: [],
            status: 'active',
            lastSeen: Date.now(),
            collaboratesWith: [],
          }),
        ),
      );

      // Each agent sends messages to all others rapidly
      const messagePromises = [];

      for (let index = 0; index < messageCount; index++) {
        const fromAgent = agents[index % agents.length];
        const toAgent = agents[(index + 1) % agents.length];

        messagePromises.push(
          messageService.sendMessage(
            fromAgent,
            toAgent,
            MessageType.CONTEXT,
            `Rapid message ${index}`,
            {
              metadata: { sequence: index, timestamp: Date.now() },
            },
          ),
        );
      }

      const messageIds = await Promise.all(messagePromises);

      expect(messageIds).toHaveLength(messageCount);
      expect(new Set(messageIds).size).toBe(messageCount); // All IDs should be unique

      // Verify message integrity
      for (const agent of agents) {
        const messages = await messageService.getMessages(agent, { markAsRead: false });

        expect(messages.messages.length).toBeGreaterThan(0);
      }
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const operations = [];

      // Mix different types of operations
      for (let index = 0; index < 20; index++) {
        // Mix different types of operations
        operations.push(
          // Message sending
          messageService.sendMessage('agent1', 'agent2', MessageType.CONTEXT, `msg-${index}`),
          // Agent status checks
          agentService.getHubStatus(),
        );
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations);

      // All operations should succeed
      expect(results).toHaveLength(40); // 20 * 2 operations

      // Verify data integrity
      const messages = await messageService.getMessages('agent2');
      const hubStatus = await agentService.getHubStatus();

      expect(messages.messages.length).toBeGreaterThanOrEqual(20);
      expect(hubStatus.agents.total).toBeGreaterThanOrEqual(1);
    });

    it('should handle malformed metadata gracefully', async () => {
      // Send message with potentially problematic metadata
      const problematicMetadata = {
        simpleValue: 'safe',
        number: 123,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined,
      };

      // Should handle gracefully without throwing
      const messageId = await messageService.sendMessage(
        'agent1',
        'agent2',
        MessageType.CONTEXT,
        'Test message',
        { metadata: problematicMetadata },
      );

      expect(messageId).toBeDefined();

      // Retrieve and verify message
      const messages = await messageService.getMessages('agent2');

      expect(messages.messages).toHaveLength(1);
      expect(messages.messages[0].content).toBe('Test message');
      expect(messages.messages[0].metadata).toBeDefined();
    });

    it('should handle agent ID changes during active session', async () => {
      // Start with one ID
      const originalAgent: AgentRegistration = {
        id: 'original-id',
        projectPath: '/Users/test/project',
        role: 'Developer',
        capabilities: [],
        status: 'active',
        lastSeen: Date.now(),
        collaboratesWith: [],
      };

      await storage.saveAgent(originalAgent);

      // Send messages to original ID
      await messageService.sendMessage('sender', 'original-id', MessageType.CONTEXT, 'Message 1');

      // Agent "reconnects" with new ID (simulating restart)
      const newAgent: AgentRegistration = {
        ...originalAgent,
        id: 'new-id',
        lastSeen: Date.now() + 1000,
      };

      await storage.saveAgent(newAgent);

      // Send messages to new ID
      await messageService.sendMessage('sender', 'new-id', MessageType.CONTEXT, 'Message 2');

      // Both IDs should have their respective messages
      const originalMessages = await messageService.getMessages('original-id');
      const newMessages = await messageService.getMessages('new-id');

      expect(originalMessages.messages).toHaveLength(1);
      expect(originalMessages.messages[0].content).toBe('Message 1');
      expect(newMessages.messages).toHaveLength(1);
      expect(newMessages.messages[0].content).toBe('Message 2');
    });

    it('should handle hub status queries gracefully', async () => {
      // Query hub status
      const result = await agentService.getHubStatus();

      expect(result.agents).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.messages).toBeDefined();

      // Check that we get the correct structure
      expect(result.agents.total).toBeGreaterThanOrEqual(0);
      expect(result.features.active).toBeDefined();
      expect(result.features.total).toBeGreaterThanOrEqual(0);

      // System should handle queries gracefully
      expect(result.messages.totalUnread).toBeGreaterThanOrEqual(0);
    });
  });
});
