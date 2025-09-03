import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentService } from '~/agents/service';
import { FeaturesService } from '~/features/service';
import { MessageService } from '~/messaging/service';
import { FileStorage } from '~/storage';
import { createToolHandlers, ToolHandlerServices } from '~/tools/handlers';

import { AgentRegistration, MessagePriority, MessageType } from '~/types';

// Mock createId to make tests deterministic
vi.mock('@paralleldrive/cuid2', () => {
  let counter = 0;

  return {
    createId: vi.fn(() => `msg-${++counter}`),
  };
});

describe('Messaging Integration Tests', () => {
  let storage: FileStorage;
  let messageService: MessageService;
  let featuresService: FeaturesService;
  let agentService: AgentService;
  let toolHandlers: any;

  const testAgents: AgentRegistration[] = [
    {
      id: 'frontend-dev',
      projectPath: '/Users/test/frontend',
      role: 'Frontend Developer',
      capabilities: ['react', 'typescript', 'ui'],
      status: 'active',
      lastSeen: Date.now(),
      collaboratesWith: ['backend-dev'],
    },
    {
      id: 'backend-dev',
      projectPath: '/Users/test/backend',
      role: 'Backend Developer',
      capabilities: ['node', 'database', 'api'],
      status: 'active',
      lastSeen: Date.now(),
      collaboratesWith: ['frontend-dev'],
    },
    {
      id: 'mobile-dev',
      projectPath: '/Users/test/mobile',
      role: 'Mobile Developer',
      capabilities: ['react-native', 'ios', 'android'],
      status: 'active',
      lastSeen: Date.now(),
      collaboratesWith: [],
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create services with temporary directory
    storage = new FileStorage(`/tmp/agent-hub-messaging-test-${Date.now()}`);
    await storage.init();

    messageService = new MessageService(storage);
    featuresService = new FeaturesService(storage);
    agentService = new AgentService(storage, featuresService, messageService);

    const services: ToolHandlerServices = {
      storage,
      messageService,
      agentService,
      getCurrentSession: () => ({ agent: testAgents[0] }) as any,
      broadcastNotification: vi.fn().mockResolvedValue(undefined),
      sendNotificationToAgent: vi.fn().mockResolvedValue(undefined),
      sendResourceNotification: vi.fn().mockResolvedValue(undefined),
    };

    toolHandlers = createToolHandlers(services);

    // Register test agents
    for (const agent of testAgents) {
      await storage.saveAgent(agent);
    }
  });

  describe('Message Types and Priorities', () => {
    it('should handle all message types correctly', async () => {
      const messageTypes = [
        { type: MessageType.CONTEXT, content: 'Sharing project context and requirements' },
        { type: MessageType.TASK, content: 'Please implement user authentication' },
        { type: MessageType.QUESTION, content: 'What API endpoint should I use for login?' },
        { type: MessageType.COMPLETION, content: 'Authentication module is ready for testing' },
        { type: MessageType.ERROR, content: 'Database connection failed - investigating' },
      ];

      // Send different message types
      for (const { content, type } of messageTypes) {
        await toolHandlers.send_message({
          from: 'frontend-dev',
          to: 'backend-dev',
          type,
          content,
        });
      }

      // Retrieve all messages
      const result = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(result.count).toBe(5);
      expect(result.messages).toHaveLength(5);

      // Verify each message type is present
      const receivedTypes = result.messages.map((m: any) => m.type);

      expect(receivedTypes).toContain('context');
      expect(receivedTypes).toContain('task');
      expect(receivedTypes).toContain('question');
      expect(receivedTypes).toContain('completion');
      expect(receivedTypes).toContain('error');
    });

    it('should handle message priorities correctly', async () => {
      const priorityMessages = [
        { priority: MessagePriority.LOW, content: 'Low priority update' },
        { priority: MessagePriority.NORMAL, content: 'Normal priority request' },
        { priority: MessagePriority.URGENT, content: 'Urgent production issue!' },
      ];

      // Send messages with different priorities
      for (const { content, priority } of priorityMessages) {
        await toolHandlers.send_message({
          from: 'backend-dev',
          to: 'frontend-dev',
          type: MessageType.CONTEXT,
          content,
          priority,
        });
      }

      const result = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      expect(result.count).toBe(3);

      // Verify priorities are preserved
      const priorities = result.messages.map((m: any) => m.priority);

      expect(priorities).toContain('low');
      expect(priorities).toContain('normal');
      expect(priorities).toContain('urgent');
    });

    it('should filter messages by type correctly', async () => {
      // Send mixed message types
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.TASK,
        content: 'Task message 1',
      });

      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Context message 1',
      });

      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.TASK,
        content: 'Task message 2',
      });

      // Filter for only task messages
      const taskMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        type: 'task',
        markAsRead: false,
      });

      expect(taskMessages.count).toBe(2);
      expect(taskMessages.messages).toHaveLength(2);
      expect(taskMessages.messages[0].type).toBe('task');
      expect(taskMessages.messages[1].type).toBe('task');

      // Filter for only context messages
      const contextMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        type: 'context',
        markAsRead: false,
      });

      expect(contextMessages.count).toBe(1);
      expect(contextMessages.messages[0].type).toBe('context');
    });
  });

  describe('Message Workflows', () => {
    it('should support question-answer workflow', async () => {
      // Frontend asks a question
      const questionResult = await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.QUESTION,
        content: 'What data format should I use for user profiles?',
        metadata: { category: 'api-design', urgency: 'medium' },
      });

      // Backend responds with answer
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'frontend-dev',
        type: MessageType.CONTEXT,
        content: 'Use JSON format with these fields: { id, name, email, avatar, createdAt }',
        threadId: questionResult.messageId,
        metadata: { category: 'api-design', responseType: 'specification' },
      });

      // Verify the conversation
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(frontendMessages.count).toBe(1); // Received answer
      expect(backendMessages.count).toBe(1); // Received question

      // Verify thread connection
      expect(frontendMessages.messages[0].threadId).toBe(questionResult.messageId);
    });

    it('should support task assignment and completion workflow', async () => {
      // Assign a task
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'frontend-dev',
        type: MessageType.TASK,
        content: 'Please implement user login form with validation',
        metadata: {
          taskId: 'login-form-001',
          deadline: '2024-01-20',
          requirements: ['email validation', 'password strength', 'error handling'],
        },
      });

      // Acknowledge task
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Task acknowledged - starting work on login form',
        metadata: { taskId: 'login-form-001', status: 'started' },
      });

      // Report completion
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.COMPLETION,
        content: 'Login form completed with all validations implemented',
        metadata: {
          taskId: 'login-form-001',
          status: 'completed',
          deliverables: ['login.tsx', 'validation.ts', 'tests'],
        },
      });

      // Verify workflow
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(frontendMessages.count).toBe(1); // Received task
      expect(backendMessages.count).toBe(2); // Received acknowledgment and completion

      // Verify task metadata flow
      expect(frontendMessages.messages[0].metadata.taskId).toBe('login-form-001');
      expect(backendMessages.messages.some((m: any) => m.metadata?.status === 'completed')).toBe(
        true,
      );
    });

    it('should support error reporting and incident response workflow', async () => {
      // Report an error
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'all',
        type: MessageType.ERROR,
        content: 'Production database connection timeout - API responses failing',
        priority: MessagePriority.URGENT,
        metadata: {
          incident: 'DB-2024-001',
          severity: 'critical',
          affectedServices: ['auth', 'profiles', 'notifications'],
          startTime: Date.now(),
        },
      });

      // Frontend acknowledges and reports impact
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Frontend detecting 500 errors on login attempts - switching to maintenance mode',
        metadata: { incident: 'DB-2024-001', action: 'maintenance-mode-enabled' },
      });

      // Mobile dev also reports impact
      await toolHandlers.send_message({
        from: 'mobile-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Mobile app experiencing authentication failures - displaying offline mode',
        metadata: { incident: 'DB-2024-001', action: 'offline-mode-enabled' },
      });

      // Backend reports resolution
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'all',
        type: MessageType.COMPLETION,
        content: 'Database connection restored - all services operational',
        metadata: {
          incident: 'DB-2024-001',
          status: 'resolved',
          resolutionTime: Date.now(),
          nextSteps: ['monitor for 30min', 'post-mortem meeting'],
        },
      });

      // Verify incident response workflow
      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      const mobileMessages = await toolHandlers.get_messages({
        agent: 'mobile-dev',
        markAsRead: false,
      });

      // Backend should see responses from frontend and mobile (not their own broadcasts)
      expect(backendMessages.count).toBe(2);

      // Each client should see the error broadcast and resolution
      expect(frontendMessages.count).toBe(2);
      expect(mobileMessages.count).toBe(2);

      // Verify incident tracking - should see responses from other agents
      const incidentResponses = backendMessages.messages.filter(
        (m: any) =>
          m.metadata?.incident === 'DB-2024-001' &&
          m.from !== 'backend-dev' &&
          m.type === MessageType.CONTEXT,
      );

      expect(incidentResponses).toHaveLength(2); // Frontend and mobile responses
    });
  });

  describe('Broadcast and Group Messaging', () => {
    it('should deliver broadcast messages to all agents', async () => {
      // Send broadcast message
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'all',
        type: MessageType.CONTEXT,
        content: 'New API version deployed - please update your integration tests',
        metadata: { version: '2.1.0', breaking: false },
      });

      // Check all agents received the broadcast
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      const mobileMessages = await toolHandlers.get_messages({
        agent: 'mobile-dev',
        markAsRead: false,
      });

      expect(frontendMessages.count).toBe(1);
      expect(mobileMessages.count).toBe(1);
      expect(frontendMessages.messages[0].content).toContain('API version deployed');
      expect(mobileMessages.messages[0].content).toContain('API version deployed');

      // Verify sender does not receive their own broadcast message
      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(backendMessages.count).toBe(0); // Sender should not see their own broadcast
    });

    it('should exclude sender from broadcast message recipients', async () => {
      // Frontend sends a broadcast message
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'all',
        type: MessageType.CONTEXT,
        content: 'UI component library has been updated',
      });

      // Check that other agents received the message
      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      const mobileMessages = await toolHandlers.get_messages({
        agent: 'mobile-dev',
        markAsRead: false,
      });

      expect(backendMessages.count).toBe(1);
      expect(mobileMessages.count).toBe(1);
      expect(backendMessages.messages[0].content).toContain('UI component library');
      expect(mobileMessages.messages[0].content).toContain('UI component library');

      // Verify the sender (frontend-dev) does not receive their own broadcast
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      expect(frontendMessages.count).toBe(0); // Sender should not see their own broadcast
    });

    it('should handle mixed broadcast and direct messages correctly', async () => {
      // Send broadcast
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'all',
        type: MessageType.CONTEXT,
        content: 'Code freeze starts tomorrow',
      });

      // Send direct message to frontend
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'frontend-dev',
        type: MessageType.TASK,
        content: 'Finish the user dashboard before code freeze',
      });

      // Send direct message to mobile
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'mobile-dev',
        type: MessageType.TASK,
        content: 'Update push notification handling',
      });

      // Verify message distribution
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      const mobileMessages = await toolHandlers.get_messages({
        agent: 'mobile-dev',
        markAsRead: false,
      });

      // Frontend should get broadcast + direct message
      expect(frontendMessages.count).toBe(2);
      expect(frontendMessages.messages.some((m: any) => m.content.includes('code freeze'))).toBe(
        true,
      );
      expect(frontendMessages.messages.some((m: any) => m.content.includes('dashboard'))).toBe(
        true,
      );

      // Mobile should get broadcast + different direct message
      expect(mobileMessages.count).toBe(2);
      expect(
        mobileMessages.messages.some(
          (m: any) => m.content.includes('Code freeze') || m.content.includes('code freeze'),
        ),
      ).toBe(true);
      expect(
        mobileMessages.messages.some((m: any) => m.content.includes('push notification')),
      ).toBe(true);
    });
  });

  describe('Message Threading and Context', () => {
    it('should maintain conversation threads correctly', async () => {
      // Start a conversation thread
      const initialResult = await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.QUESTION,
        content: 'How should we handle user session persistence?',
      });

      // Continue the thread
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'frontend-dev',
        type: MessageType.CONTEXT,
        content: 'We can use JWT tokens with refresh token rotation',
        threadId: initialResult.messageId,
      });

      // Add to the same thread
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.QUESTION,
        content: 'Where should we store the refresh tokens on the client?',
        threadId: initialResult.messageId,
      });

      // Final response in thread
      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'frontend-dev',
        type: MessageType.CONTEXT,
        content: 'Use httpOnly cookies for refresh tokens, localStorage for access tokens',
        threadId: initialResult.messageId,
      });

      // Verify thread continuity
      const frontendMessages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      const backendMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      // Check thread IDs are preserved
      const frontendThreadMessages = frontendMessages.messages.filter(
        (m: any) => m.threadId === initialResult.messageId,
      );
      const backendThreadMessages = backendMessages.messages.filter(
        (m: any) => m.threadId === initialResult.messageId,
      );

      expect(frontendThreadMessages).toHaveLength(2); // 2 responses received
      expect(backendThreadMessages).toHaveLength(1); // 1 additional question received (initial question not returned to sender)

      // Verify conversation flow (only one threaded question received by backend)
      expect(backendThreadMessages[0].content).toContain('refresh tokens on the client');
    });

    it('should handle rich metadata for context sharing', async () => {
      const complexMetadata = {
        project: 'user-management',
        sprint: '2024-S1',
        storyPoints: 8,
        acceptance: {
          criteria: ['login works', 'logout works', 'session expires'],
          definition: 'User can authenticate and maintain session',
        },
        technical: {
          apis: ['/auth/login', '/auth/logout', '/auth/refresh'],
          components: ['LoginForm', 'AuthProvider', 'SessionManager'],
          dependencies: ['jsonwebtoken', 'bcrypt', 'express-session'],
        },
        timeline: {
          start: '2024-01-10',
          review: '2024-01-15',
          deployment: '2024-01-20',
        },
      };

      await toolHandlers.send_message({
        from: 'backend-dev',
        to: 'frontend-dev',
        type: MessageType.CONTEXT,
        content: 'Authentication system specification ready for implementation',
        metadata: complexMetadata,
      });

      const messages = await toolHandlers.get_messages({
        agent: 'frontend-dev',
        markAsRead: false,
      });

      expect(messages.count).toBe(1);
      expect(messages.messages[0].metadata).toEqual(complexMetadata);
      expect(messages.messages[0].metadata.technical.apis).toContain('/auth/login');
      expect(messages.messages[0].metadata.acceptance.criteria).toHaveLength(3);
    });
  });

  describe('Message Persistence and Retrieval', () => {
    it('should maintain message order by timestamp', async () => {
      const messageContents = [
        'First message',
        'Second message',
        'Third message',
        'Fourth message',
      ];

      // Send messages with slight delays to ensure different timestamps
      for (const messageContent of messageContents) {
        await toolHandlers.send_message({
          from: 'frontend-dev',
          to: 'backend-dev',
          type: MessageType.CONTEXT,
          content: messageContent,
        });

        // Small delay to ensure timestamp ordering
        await new Promise<void>(resolve => {
          setTimeout(resolve, 1);
        });
      }

      const messages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(messages.count).toBe(4);
      expect(messages.messages).toHaveLength(4);

      // Verify messages are in timestamp order (oldest first)
      for (const [index, messageContent] of messageContents.entries()) {
        expect(messages.messages[index].content).toBe(messageContent);
      }

      // Verify timestamps are increasing
      for (let index = 1; index < messages.messages.length; index++) {
        expect(messages.messages[index].timestamp).toBeGreaterThanOrEqual(
          messages.messages[index - 1].timestamp,
        );
      }
    });

    it('should handle message read/unread status correctly', async () => {
      // Send test messages
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Test message 1',
      });

      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Test message 2',
      });

      // Get messages without marking as read
      const unreadMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(unreadMessages.count).toBe(2);
      expect(unreadMessages.messages[0].read).toBe(false);
      expect(unreadMessages.messages[1].read).toBe(false);

      // Get messages and mark as read (default behavior)
      const readMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
      });

      expect(readMessages.count).toBe(2);

      // Subsequent calls should return no unread messages
      const noUnreadMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(noUnreadMessages.count).toBe(0);
      expect(noUnreadMessages.messages).toHaveLength(0);
    });

    it('should filter messages by timestamp correctly', async () => {
      const beforeTimestamp = Date.now();

      // Wait a moment to ensure clear timestamp separation
      await new Promise<void>(resolve => {
        setTimeout(resolve, 10);
      });

      // Send messages after the timestamp
      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Message after timestamp',
      });

      await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: 'Another message after timestamp',
      });

      // Get messages since the before timestamp
      const recentMessages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        since: beforeTimestamp,
        markAsRead: false,
      });

      expect(recentMessages.count).toBe(2);
      expect(recentMessages.messages).toHaveLength(2);

      // All returned messages should be after the timestamp
      for (const message of recentMessages.messages) {
        expect(message.timestamp).toBeGreaterThan(beforeTimestamp);
      }
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle messages to non-existent agents', async () => {
      // Send message to non-existent agent (should not throw)
      const result = await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'non-existent-agent',
        type: MessageType.CONTEXT,
        content: 'Message to nowhere',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      // Message should be stored and retrievable if agent comes online
      const messages = await toolHandlers.get_messages({
        agent: 'non-existent-agent',
        markAsRead: false,
      });

      expect(messages.count).toBe(1);
      expect(messages.messages[0].content).toBe('Message to nowhere');
    });

    it('should handle minimal message content', async () => {
      const result = await toolHandlers.send_message({
        from: 'frontend-dev',
        to: 'backend-dev',
        type: MessageType.CONTEXT,
        content: '?', // Minimal valid content
      });

      expect(result.success).toBe(true);

      const messages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(messages.count).toBe(1);
      expect(messages.messages[0].content).toBe('?');
    });

    it('should handle concurrent message operations', async () => {
      const concurrentMessages = Array.from({ length: 20 }, (_, index) =>
        toolHandlers.send_message({
          from: 'frontend-dev',
          to: 'backend-dev',
          type: MessageType.CONTEXT,
          content: `Concurrent message ${index}`,
        }),
      );

      // All sends should succeed
      const results = await Promise.all(concurrentMessages);

      expect(results).toHaveLength(20);
      expect(results.every(r => r.success)).toBe(true);

      // All messages should be retrievable
      const messages = await toolHandlers.get_messages({
        agent: 'backend-dev',
        markAsRead: false,
      });

      expect(messages.count).toBe(20);
      expect(messages.messages).toHaveLength(20);

      // All message IDs should be unique
      const messageIds = messages.messages.map((m: any) => m.id);

      expect(new Set(messageIds).size).toBe(20);
    });
  });
});
