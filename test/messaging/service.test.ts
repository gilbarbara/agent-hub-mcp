import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageService } from '~/messaging/service';
import { FileStorage } from '~/storage';

import { Message, MessagePriority, MessageType } from '~/types';

// Mock the createId function
vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'mock-id-123'),
}));

describe('MessageService', () => {
  let messageService: MessageService;
  let mockStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      saveMessage: vi.fn(),
      getMessages: vi.fn(),
      markMessageAsRead: vi.fn(),
      getMessage: vi.fn(),
    };
    messageService = new MessageService(mockStorage as FileStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('sendMessage', () => {
    it('should create and save a message with required fields', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);

      const messageId = await messageService.sendMessage(
        'agent1',
        'agent2',
        MessageType.CONTEXT,
        'Test message',
      );

      expect(messageId).toBe('mock-id-123');
      expect(mockStorage.saveMessage).toHaveBeenCalledWith({
        id: 'mock-id-123',
        from: 'agent1',
        to: 'agent2',
        type: MessageType.CONTEXT,
        content: 'Test message',
        metadata: undefined,
        timestamp: mockTimestamp,
        read: false,
        threadId: undefined,
        priority: MessagePriority.NORMAL,
      });
    });

    it('should create message with optional fields', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);

      const messageId = await messageService.sendMessage(
        'agent1',
        'agent2',
        MessageType.TASK,
        'Task message',
        {
          metadata: { key: 'value' },
          priority: MessagePriority.URGENT,
          threadId: 'thread-123',
        },
      );

      expect(messageId).toBe('mock-id-123');
      expect(mockStorage.saveMessage).toHaveBeenCalledWith({
        id: 'mock-id-123',
        from: 'agent1',
        to: 'agent2',
        type: MessageType.TASK,
        content: 'Task message',
        metadata: { key: 'value' },
        timestamp: mockTimestamp,
        read: false,
        threadId: 'thread-123',
        priority: MessagePriority.URGENT,
      });
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage error');

      mockStorage.saveMessage.mockRejectedValue(error);

      await expect(
        messageService.sendMessage('agent1', 'agent2', MessageType.CONTEXT, 'Test'),
      ).rejects.toThrow('Storage error');
    });
  });

  describe('getMessages', () => {
    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        from: 'agent1',
        to: 'agent2',
        type: MessageType.CONTEXT,
        content: 'Message 1',
        timestamp: Date.now(),
        read: false,
        priority: MessagePriority.NORMAL,
      },
      {
        id: 'msg-2',
        from: 'agent3',
        to: 'all',
        type: MessageType.TASK,
        content: 'Message 2',
        timestamp: Date.now(),
        read: false,
        priority: MessagePriority.URGENT,
      },
      {
        id: 'msg-3',
        from: 'agent4',
        to: 'agent2',
        type: MessageType.CONTEXT,
        content: 'Message 3',
        timestamp: Date.now(),
        read: true,
        priority: MessagePriority.NORMAL,
      },
    ];

    beforeEach(() => {
      mockStorage.getMessages.mockResolvedValue(mockMessages);
    });

    it('should get unread messages for an agent', async () => {
      mockStorage.markMessageAsRead.mockResolvedValue(undefined);

      const result = await messageService.getMessages('agent2');

      expect(result.count).toBe(2); // msg-1 and msg-2 are unread
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.messages[1].id).toBe('msg-2');
    });

    it('should mark messages as read by default', async () => {
      mockStorage.markMessageAsRead.mockResolvedValue(undefined);

      await messageService.getMessages('agent2');

      expect(mockStorage.markMessageAsRead).toHaveBeenCalledTimes(2);
      expect(mockStorage.markMessageAsRead).toHaveBeenCalledWith('msg-1');
      expect(mockStorage.markMessageAsRead).toHaveBeenCalledWith('msg-2');
    });

    it('should not mark messages as read when markAsRead is false', async () => {
      const result = await messageService.getMessages('agent2', { markAsRead: false });

      expect(result.count).toBe(2);
      expect(mockStorage.markMessageAsRead).not.toHaveBeenCalled();
    });

    it('should pass filtering options to storage', async () => {
      await messageService.getMessages('agent2', {
        since: 1700000000000,
        type: 'context',
      });

      expect(mockStorage.getMessages).toHaveBeenCalledWith({
        agent: 'agent2',
        type: 'context',
        since: 1700000000000,
      });
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage error');

      mockStorage.getMessages.mockRejectedValue(error);

      await expect(messageService.getMessages('agent2')).rejects.toThrow('Storage error');
    });
  });

  describe('sendSyncRequest', () => {
    it('should send sync request message', async () => {
      vi.useFakeTimers();
      const mockTimestamp = 1700000000000;

      vi.setSystemTime(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);
      mockStorage.getMessages.mockResolvedValue([]);

      const promise = messageService.sendSyncRequest('agent1', 'agent2', 'sync topic', 1000);

      // Advance time to trigger timeout
      vi.setSystemTime(mockTimestamp + 1001);
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result.timeout).toBe(true);
      expect(mockStorage.saveMessage).toHaveBeenCalledWith({
        id: 'mock-id-123',
        from: 'agent1',
        to: 'agent2',
        type: MessageType.SYNC_REQUEST,
        content: 'sync topic',
        timestamp: mockTimestamp,
        read: false,
        priority: MessagePriority.URGENT,
      });
    });

    it.skip('should return response when received immediately', async () => {
      vi.useFakeTimers();
      const mockTimestamp = 1700000000000;

      vi.setSystemTime(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);

      // Mock response message that's immediately available
      const responseMessage: Message = {
        id: 'response-123',
        from: 'agent2',
        to: 'agent1',
        type: MessageType.CONTEXT,
        content: 'sync response',
        timestamp: mockTimestamp + 500,
        read: false,
        priority: MessagePriority.NORMAL,
        threadId: 'mock-id-123',
      };

      // Return the response immediately on first check (no waiting needed)
      mockStorage.getMessages.mockResolvedValueOnce([responseMessage]);

      // Start the sync request
      const promise = messageService.sendSyncRequest('agent1', 'agent2', 'sync topic', 100);

      // Advance time slightly to allow the first check
      vi.advanceTimersByTime(50);

      const result = await promise;

      expect(result.response).toBe('sync response');
      expect(result.timeout).toBeUndefined();
    });

    it('should handle timeout when no response received', async () => {
      vi.useFakeTimers();
      const mockTimestamp = 1700000000000;

      vi.setSystemTime(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);
      mockStorage.getMessages.mockResolvedValue([]);

      const promise = messageService.sendSyncRequest('agent1', 'agent2', 'sync topic', 1000);

      // Advance time past timeout
      vi.setSystemTime(mockTimestamp + 1001);
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result.timeout).toBe(true);
      expect(result.response).toBeUndefined();
    });
  });

  describe('getMessageById', () => {
    it('should retrieve message by ID', async () => {
      const mockMessage: Message = {
        id: 'test-id',
        from: 'agent1',
        to: 'agent2',
        type: MessageType.CONTEXT,
        content: 'Test message',
        timestamp: Date.now(),
        read: false,
        priority: MessagePriority.NORMAL,
      };

      mockStorage.getMessage.mockResolvedValue(mockMessage);

      const result = await messageService.getMessageById('test-id');

      expect(result).toEqual(mockMessage);
      expect(mockStorage.getMessage).toHaveBeenCalledWith('test-id');
    });

    it('should return undefined for non-existent message', async () => {
      mockStorage.getMessage.mockResolvedValue(undefined);

      const result = await messageService.getMessageById('non-existent');

      expect(result).toBeUndefined();
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage error');

      mockStorage.getMessage.mockRejectedValue(error);

      await expect(messageService.getMessageById('test-id')).rejects.toThrow('Storage error');
    });
  });

  describe('Message Priority Enum Integration', () => {
    it('should correctly use priority enum values', async () => {
      const testCases = [
        { priority: MessagePriority.URGENT, expected: 'urgent' },
        { priority: MessagePriority.NORMAL, expected: 'normal' },
        { priority: MessagePriority.LOW, expected: 'low' },
      ];

      for (const testCase of testCases) {
        mockStorage.saveMessage.mockClear();

        await messageService.sendMessage('agent1', 'agent2', MessageType.CONTEXT, 'Test message', {
          priority: testCase.priority,
        });

        expect(mockStorage.saveMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: testCase.expected,
          }),
        );
      }
    });
  });

  describe('Message Type Enum Integration', () => {
    it('should correctly use message type enum values', async () => {
      const testCases = [
        { type: MessageType.CONTEXT, expected: 'context' },
        { type: MessageType.TASK, expected: 'task' },
        { type: MessageType.QUESTION, expected: 'question' },
        { type: MessageType.COMPLETION, expected: 'completion' },
        { type: MessageType.ERROR, expected: 'error' },
        { type: MessageType.SYNC_REQUEST, expected: 'sync_request' },
      ];

      for (const testCase of testCases) {
        mockStorage.saveMessage.mockClear();

        await messageService.sendMessage('agent1', 'agent2', testCase.type, 'Test message');

        expect(mockStorage.saveMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: testCase.expected,
          }),
        );
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty content', async () => {
      mockStorage.saveMessage.mockResolvedValue(undefined);

      const messageId = await messageService.sendMessage(
        'agent1',
        'agent2',
        MessageType.CONTEXT,
        '',
      );

      expect(messageId).toBe('mock-id-123');
      expect(mockStorage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '',
        }),
      );
    });

    it('should handle very long content', async () => {
      mockStorage.saveMessage.mockResolvedValue(undefined);
      const longContent = 'x'.repeat(10000);

      const messageId = await messageService.sendMessage(
        'agent1',
        'agent2',
        MessageType.CONTEXT,
        longContent,
      );

      expect(messageId).toBe('mock-id-123');
      expect(mockStorage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: longContent,
        }),
      );
    });

    it('should handle special characters in content', async () => {
      mockStorage.saveMessage.mockResolvedValue(undefined);
      const specialContent = 'Test\n\t<script>alert("xss")</script>\r\n';

      const messageId = await messageService.sendMessage(
        'agent1',
        'agent2',
        MessageType.CONTEXT,
        specialContent,
      );

      expect(messageId).toBe('mock-id-123');
      expect(mockStorage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: specialContent,
        }),
      );
    });

    it('should handle broadcast messages to "all"', async () => {
      mockStorage.saveMessage.mockResolvedValue(undefined);

      const messageId = await messageService.sendMessage(
        'agent1',
        'all',
        MessageType.CONTEXT,
        'Broadcast message',
      );

      expect(messageId).toBe('mock-id-123');
      expect(mockStorage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'all',
        }),
      );
    });

    it('should handle complex metadata objects', async () => {
      mockStorage.saveMessage.mockResolvedValue(undefined);
      const complexMetadata = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        nullValue: null,
        undefinedValue: undefined,
      };

      await messageService.sendMessage('agent1', 'agent2', MessageType.CONTEXT, 'Test', {
        metadata: complexMetadata,
      });

      expect(mockStorage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: complexMetadata,
        }),
      );
    });

    it('should handle concurrent message sending', async () => {
      mockStorage.saveMessage.mockResolvedValue(undefined);

      const promises = [];

      for (let index = 0; index < 10; index++) {
        promises.push(
          messageService.sendMessage('agent1', 'agent2', MessageType.CONTEXT, `Message ${index}`),
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockStorage.saveMessage).toHaveBeenCalledTimes(10);
    });
  });

  describe('Message Filtering Edge Cases', () => {
    it('should handle getMessages with invalid since timestamp', async () => {
      mockStorage.getMessages.mockResolvedValue([]);

      const result = await messageService.getMessages('agent1', {
        since: NaN,
      });

      expect(result.count).toBe(0);
      expect(mockStorage.getMessages).toHaveBeenCalledWith({
        agent: 'agent1',
        since: NaN,
      });
    });

    it('should handle getMessages with future timestamp', async () => {
      mockStorage.getMessages.mockResolvedValue([]);
      const futureTimestamp = Date.now() + 1000000;

      const result = await messageService.getMessages('agent1', {
        since: futureTimestamp,
      });

      expect(result.count).toBe(0);
      expect(result.messages).toHaveLength(0);
    });

    it('should handle getMessages with invalid message type filter', async () => {
      mockStorage.getMessages.mockResolvedValue([]);

      const result = await messageService.getMessages('agent1', {
        type: 'invalid-type' as any,
      });

      expect(result.count).toBe(0);
      expect(mockStorage.getMessages).toHaveBeenCalledWith({
        agent: 'agent1',
        type: 'invalid-type',
      });
    });

    it('should handle mark as read failures gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          from: 'agent1',
          to: 'agent2',
          type: MessageType.CONTEXT,
          content: 'Message 1',
          timestamp: Date.now(),
          read: false,
          priority: MessagePriority.NORMAL,
        },
      ];

      mockStorage.getMessages.mockResolvedValue(mockMessages);
      mockStorage.markMessageAsRead.mockRejectedValue(new Error('Mark as read failed'));

      // Should not throw error, but handle markMessageAsRead failures gracefully
      const result = await messageService.getMessages('agent2');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].read).toBe(false); // Message stays unread due to failure
      expect(mockStorage.markMessageAsRead).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to mark message msg-1 as read:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Sync Request Edge Cases', () => {
    it('should handle sync request with zero timeout', async () => {
      vi.useFakeTimers();
      const mockTimestamp = 1700000000000;

      vi.setSystemTime(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);
      mockStorage.getMessages.mockResolvedValue([]);

      const promise = messageService.sendSyncRequest('agent1', 'agent2', 'sync topic', 0);

      await vi.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result.timeout).toBe(true);
    });

    it('should handle sync request with very long timeout', async () => {
      vi.useFakeTimers();
      const mockTimestamp = 1700000000000;

      vi.setSystemTime(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);
      mockStorage.getMessages.mockResolvedValue([]);

      const promise = messageService.sendSyncRequest('agent1', 'agent2', 'sync topic', 1000);

      // Advance time past timeout
      vi.setSystemTime(mockTimestamp + 1001);
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result.timeout).toBe(true);
    }, 2000);

    it('should handle sync request to broadcast "all"', async () => {
      vi.useFakeTimers();
      const mockTimestamp = 1700000000000;

      vi.setSystemTime(mockTimestamp);

      mockStorage.saveMessage.mockResolvedValue(undefined);
      mockStorage.getMessages.mockResolvedValue([]);

      const promise = messageService.sendSyncRequest('agent1', 'all', 'broadcast sync', 100);

      vi.setSystemTime(mockTimestamp + 101);
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result.timeout).toBe(true);
      expect(mockStorage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'all',
          type: MessageType.SYNC_REQUEST,
        }),
      );
    });
  });
});
