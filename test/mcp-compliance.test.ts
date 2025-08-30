/* eslint-disable @vitest/no-conditional-expect */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TOOLS } from '../src/tools/definitions';
import { createToolHandlers, ToolHandlerServices } from '../src/tools/handlers';
import { MessageType } from '../src/types';
import { validateToolInput } from '../src/validation';

describe('MCP Protocol Compliance', () => {
  let mockServices: ToolHandlerServices;
  let toolHandlers: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console output to prevent bleeding
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockStorage = {
      saveAgent: vi.fn().mockResolvedValue(undefined),
      getAgents: vi.fn().mockResolvedValue([]),
      saveMessage: vi.fn().mockResolvedValue(undefined),
      getMessages: vi.fn().mockResolvedValue([]),
      markMessageAsRead: vi.fn().mockResolvedValue(undefined),
      saveContext: vi.fn().mockResolvedValue(undefined),
      getContext: vi.fn().mockResolvedValue({}),
      saveTask: vi.fn().mockResolvedValue(undefined),
      getTasks: vi.fn().mockResolvedValue([]),
    } as any;

    const mockMessageService = {
      sendMessage: vi.fn().mockResolvedValue('msg-123'),
      getMessages: vi.fn().mockResolvedValue({ count: 0, messages: [] }),
      sendSyncRequest: vi.fn().mockResolvedValue({ response: 'sync-response' }),
      getMessageById: vi.fn().mockResolvedValue(undefined),
    } as any;

    const mockContextService = {
      setContext: vi.fn().mockResolvedValue({ success: true, version: 1 }),
      getContext: vi.fn().mockResolvedValue({}),
    } as any;

    const mockTaskService = {
      updateTaskStatus: vi.fn().mockResolvedValue({ success: true }),
      getAgentStatus: vi.fn().mockResolvedValue({ agents: [], tasks: [] }),
      startCollaboration: vi.fn().mockResolvedValue({
        agent: 'test-agent',
        activeAgents: [],
        pendingMessages: 0,
      }),
    } as any;

    const mockSession = {
      agent: {
        id: 'test-agent',
        projectPath: '/test',
        role: 'Test Agent',
        capabilities: ['test'],
        status: 'active' as const,
        lastSeen: Date.now(),
        collaboratesWith: [],
      },
    } as any; // Mock session object for testing

    mockServices = {
      storage: mockStorage,
      messageService: mockMessageService,
      contextService: mockContextService,
      taskService: mockTaskService,
      getCurrentSession: vi.fn().mockReturnValue(mockSession),
      broadcastNotification: vi.fn().mockResolvedValue(undefined),
      sendNotificationToAgent: vi.fn().mockResolvedValue(undefined),
      sendResourceNotification: vi.fn().mockResolvedValue(undefined),
    };

    toolHandlers = createToolHandlers(mockServices);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Schema Compliance', () => {
    it('should have valid JSON schemas for all tools', () => {
      expect(TOOLS).toBeDefined();
      expect(TOOLS.length).toBeGreaterThan(0);

      for (const tool of TOOLS) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);

        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');

        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it('should have required fields specified correctly', () => {
      const expectedRequiredFields = {
        send_message: ['from', 'to', 'type', 'content'],
        get_messages: ['agent'],
        set_context: ['key', 'value', 'agent'],
        register_agent: ['projectPath', 'role'],
        update_task_status: ['agent', 'task', 'status'],
        sync_request: ['from', 'to', 'topic'],
      };

      for (const tool of TOOLS) {
        if (expectedRequiredFields[tool.name as keyof typeof expectedRequiredFields]) {
          expect(tool.inputSchema.required).toEqual(
            expectedRequiredFields[tool.name as keyof typeof expectedRequiredFields],
          );
        }
      }
    });

    it('should validate enum values correctly', () => {
      const messageTypeTool = TOOLS.find(t => t.name === 'send_message');

      expect(messageTypeTool).toBeDefined();

      const schema = messageTypeTool!.inputSchema;

      expect(schema.properties).toBeDefined();

      const typeProperty = schema.properties!.type as any;

      expect(typeProperty).toBeDefined();
      expect(typeProperty.enum).toBeDefined();

      expect(typeProperty.enum).toContain('context');
      expect(typeProperty.enum).toContain('task');
      expect(typeProperty.enum).toContain('question');
      expect(typeProperty.enum).toContain('completion');
      expect(typeProperty.enum).toContain('error');
      expect(typeProperty.enum).toContain('sync_request');

      const priorityProperty = schema.properties!.priority as any;

      expect(priorityProperty).toBeDefined();
      expect(priorityProperty.enum).toBeDefined();

      expect(priorityProperty.enum).toContain('urgent');
      expect(priorityProperty.enum).toContain('normal');
      expect(priorityProperty.enum).toContain('low');
    });
  });

  describe('Tool Handler Compliance', () => {
    it('should have handlers for all defined tools', () => {
      const toolNames = TOOLS.map(t => t.name);
      const handlerNames = Object.keys(toolHandlers);

      for (const toolName of toolNames) {
        expect(handlerNames).toContain(toolName);
        expect(typeof toolHandlers[toolName]).toBe('function');
      }
    });

    it('should validate inputs using schema validation', async () => {
      // Test valid inputs
      const validInputs = {
        send_message: {
          from: 'agent1',
          to: 'agent2',
          type: MessageType.CONTEXT,
          content: 'Test message',
        },
        get_messages: {
          agent: 'agent1',
        },
        set_context: {
          key: 'test-key',
          value: { test: 'data' },
          agent: 'agent1',
        },
      };

      for (const [toolName, input] of Object.entries(validInputs)) {
        expect(() => validateToolInput(toolName, input)).not.toThrow();

        // Should not throw when called on handler
        await expect(toolHandlers[toolName](input)).resolves.toBeDefined();
      }
    });

    it('should reject invalid inputs', async () => {
      const invalidInputs = {
        send_message: [
          {}, // Missing required fields
          { from: 'agent1' }, // Missing to, type, content
          { from: 'agent1', to: 'agent2', type: 'invalid-type', content: 'msg' }, // Invalid enum
        ],
        get_messages: [
          {}, // Missing agent
          { agent: 123 }, // Wrong type
        ],
        set_context: [
          {}, // Missing required fields
          { key: 'test' }, // Missing value and agent
          { key: 'test', value: 'val' }, // Missing agent
        ],
      };

      for (const [toolName, inputs] of Object.entries(invalidInputs)) {
        for (const input of inputs) {
          expect(() => validateToolInput(toolName, input)).toThrow();
        }
      }
    });
  });

  describe('JSON-RPC 2.0 Error Compliance', () => {
    it('should throw proper errors for invalid tool calls', async () => {
      // Test missing required parameters
      await expect(toolHandlers.send_message({})).rejects.toThrow();
      await expect(toolHandlers.get_messages({})).rejects.toThrow();
      await expect(toolHandlers.set_context({})).rejects.toThrow();
    });

    it('should handle validation errors gracefully', async () => {
      const invalidInput = {
        from: 'agent1',
        to: 'agent2',
        type: 'invalid-message-type',
        content: 'test',
      };

      await expect(toolHandlers.send_message(invalidInput)).rejects.toThrow(/Validation failed/);
    });

    it('should propagate storage errors properly', async () => {
      const storageError = new Error('Storage connection failed');

      vi.spyOn(mockServices.messageService, 'sendMessage').mockRejectedValue(storageError);

      const validInput = {
        from: 'agent1',
        to: 'agent2',
        type: MessageType.CONTEXT,
        content: 'test message',
      };

      await expect(toolHandlers.send_message(validInput)).rejects.toThrow(
        'Storage connection failed',
      );
    });
  });

  describe('Response Format Compliance', () => {
    it('should return properly structured responses', async () => {
      const testCases = [
        {
          tool: 'send_message',
          input: {
            from: 'agent1',
            to: 'agent2',
            type: MessageType.CONTEXT,
            content: 'test message',
          },
          expectedFields: ['messageId'],
        },
        {
          tool: 'get_messages',
          input: { agent: 'agent1' },
          expectedFields: ['count', 'messages'],
        },
        {
          tool: 'set_context',
          input: {
            key: 'test-key',
            value: 'test-value',
            agent: 'agent1',
          },
          expectedFields: ['success', 'version'],
        },
        {
          tool: 'get_context',
          input: {},
          expectedType: 'object',
        },
        {
          tool: 'register_agent',
          input: {
            projectPath: '/test/path',
            role: 'Test Agent',
          },
          expectedFields: ['success', 'agent', 'message'],
        },
        {
          tool: 'update_task_status',
          input: {
            agent: 'agent1',
            task: 'test task',
            status: 'started',
          },
          expectedFields: ['success'],
        },
        {
          tool: 'get_agent_status',
          input: {},
          expectedFields: ['agents', 'tasks'],
        },
        {
          tool: 'start_collaboration',
          input: { feature: 'test-feature' },
          expectedFields: ['agent', 'activeAgents', 'pendingMessages'],
        },
        {
          tool: 'sync_request',
          input: {
            from: 'agent1',
            to: 'agent2',
            topic: 'test topic',
          },
          expectedFields: ['response'],
        },
      ];

      for (const testCase of testCases) {
        const result = await toolHandlers[testCase.tool](testCase.input);

        expect(result).toBeDefined();

        if (testCase.expectedFields) {
          for (const field of testCase.expectedFields) {
            expect(result).toHaveProperty(field);
          }
        }

        if (testCase.expectedType) {
          expect(typeof result).toBe(testCase.expectedType);
        }
      }
    });

    it('should return consistent boolean success indicators', async () => {
      const successTools = ['set_context', 'register_agent', 'update_task_status'];

      for (const toolName of successTools) {
        const tool = TOOLS.find(t => t.name === toolName);

        expect(tool).toBeDefined();

        // Create minimal valid input based on required fields
        const input: any = {};

        for (const requiredField of tool!.inputSchema.required ?? []) {
          switch (requiredField) {
            case 'key':
              input.key = 'test-key';
              break;
            case 'value':
              input.value = 'test-value';
              break;
            case 'agent':
              input.agent = 'test-agent';
              break;
            case 'projectPath':
              input.projectPath = '/test/path';
              break;
            case 'role':
              input.role = 'Test Role';
              break;
            case 'task':
              input.task = 'test task';
              break;
            case 'status':
              input.status = 'started';
              break;
            default:
              input[requiredField] = `test-${requiredField}`;
          }
        }

        const result = await toolHandlers[toolName](input);

        expect(result.success).toBe(true);
      }
    });
  });

  describe('Input Parameter Types', () => {
    it('should handle string parameters correctly', async () => {
      await toolHandlers.get_messages({
        agent: 'string-agent',
        type: 'context',
      });

      expect(mockServices.messageService.getMessages).toHaveBeenCalledWith(
        'string-agent',
        expect.objectContaining({ type: 'context' }),
      );
    });

    it('should handle boolean parameters correctly', async () => {
      await toolHandlers.get_messages({
        agent: 'test-agent',
        markAsRead: false,
      });

      expect(mockServices.messageService.getMessages).toHaveBeenCalledWith(
        'test-agent',
        expect.objectContaining({ markAsRead: false }),
      );
    });

    it('should handle number parameters correctly', async () => {
      const timestamp = 1700000000000;

      await toolHandlers.get_messages({
        agent: 'test-agent',
        since: timestamp,
      });

      expect(mockServices.messageService.getMessages).toHaveBeenCalledWith(
        'test-agent',
        expect.objectContaining({ since: timestamp }),
      );
    });

    it('should handle array parameters correctly', async () => {
      const capabilities = ['react', 'typescript', 'testing'];

      await toolHandlers.register_agent({
        projectPath: '/test/path',
        role: 'Frontend Developer',
        capabilities,
      });

      // Verify the capabilities array was passed through correctly
      expect(mockServices.storage.saveAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilities: expect.arrayContaining(capabilities),
        }),
      );
    });

    it('should handle object parameters correctly', async () => {
      const complexValue = {
        settings: { feature: true },
        data: [1, 2, 3],
        nested: { deep: 'value' },
      };

      await toolHandlers.set_context({
        key: 'complex-key',
        value: complexValue,
        agent: 'test-agent',
      });

      expect(mockServices.contextService.setContext).toHaveBeenCalledWith(
        'complex-key',
        complexValue,
        'test-agent',
        {},
      );
    });
  });

  describe('Tool Availability', () => {
    it('should only expose non-deprecated tools', () => {
      const toolNames = TOOLS.map(t => t.name);

      // Verify deprecated approval tools are not present
      expect(toolNames).not.toContain('approve_agent');
      expect(toolNames).not.toContain('set_approval_required');

      // Verify all current tools are present
      const expectedTools = [
        'send_message',
        'get_messages',
        'set_context',
        'get_context',
        'register_agent',
        'update_task_status',
        'get_agent_status',
        'start_collaboration',
        'sync_request',
      ];

      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
      }
    });

    it('should have matching handler for every tool definition', () => {
      const definedTools = TOOLS.map(t => t.name);
      const availableHandlers = Object.keys(toolHandlers);

      expect(definedTools.sort()).toEqual(availableHandlers.sort());
    });
  });
});
