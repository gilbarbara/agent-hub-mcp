import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextService } from '~/context/service';
import { FileStorage } from '~/storage';

import { SharedContext } from '~/types';

describe('ContextService', () => {
  let contextService: ContextService;
  let mockStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      getContext: vi.fn(),
      saveContext: vi.fn(),
    };
    contextService = new ContextService(mockStorage as FileStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('setContext', () => {
    it('should create new context with version 1', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockStorage.getContext.mockResolvedValue({}); // No existing context
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('test-key', { data: 'test-value' }, 'agent1');

      expect(result.success).toBe(true);
      expect(result.version).toBe(1);

      expect(mockStorage.saveContext).toHaveBeenCalledWith({
        key: 'test-key',
        value: { data: 'test-value' },
        version: 1,
        updatedBy: 'agent1',
        timestamp: mockTimestamp,
        ttl: undefined,
        namespace: undefined,
      });
    });

    it('should increment version for existing context', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const existingContext: SharedContext = {
        key: 'test-key',
        value: { data: 'old-value' },
        version: 5,
        updatedBy: 'agent0',
        timestamp: mockTimestamp - 1000,
      };

      mockStorage.getContext.mockResolvedValue({ 'test-key': existingContext });
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('test-key', { data: 'new-value' }, 'agent1');

      expect(result.success).toBe(true);
      expect(result.version).toBe(6);

      expect(mockStorage.saveContext).toHaveBeenCalledWith({
        key: 'test-key',
        value: { data: 'new-value' },
        version: 6,
        updatedBy: 'agent1',
        timestamp: mockTimestamp,
        ttl: undefined,
        namespace: undefined,
      });
    });

    it('should set context with TTL and namespace options', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('test-key', { data: 'test-value' }, 'agent1', {
        ttl: 3600000, // 1 hour
        namespace: 'feature-x',
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe(1);

      expect(mockStorage.saveContext).toHaveBeenCalledWith({
        key: 'test-key',
        value: { data: 'test-value' },
        version: 1,
        updatedBy: 'agent1',
        timestamp: mockTimestamp,
        ttl: 3600000,
        namespace: 'feature-x',
      });
    });

    it('should handle complex value types', async () => {
      const complexValue = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: {
          deep: 'value',
        },
      };

      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('complex-key', complexValue, 'agent1');

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          value: complexValue,
        }),
      );
    });

    it('should handle storage errors', async () => {
      mockStorage.getContext.mockResolvedValue({});
      const error = new Error('Storage save error');

      mockStorage.saveContext.mockRejectedValue(error);

      await expect(contextService.setContext('test-key', 'value', 'agent1')).rejects.toThrow(
        'Storage save error',
      );
    });

    it('should handle get context errors', async () => {
      const error = new Error('Storage get error');

      mockStorage.getContext.mockRejectedValue(error);

      await expect(contextService.setContext('test-key', 'value', 'agent1')).rejects.toThrow(
        'Storage get error',
      );
    });
  });

  describe('getContext', () => {
    it('should return context values without metadata', async () => {
      const mockContexts: Record<string, SharedContext> = {
        key1: {
          key: 'key1',
          value: { data: 'value1' },
          version: 1,
          updatedBy: 'agent1',
          timestamp: Date.now(),
        },
        key2: {
          key: 'key2',
          value: 'simple-value',
          version: 2,
          updatedBy: 'agent2',
          timestamp: Date.now(),
        },
      };

      mockStorage.getContext.mockResolvedValue(mockContexts);

      const result = await contextService.getContext();

      expect(result).toEqual({
        key1: { data: 'value1' },
        key2: 'simple-value',
      });

      expect(mockStorage.getContext).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should get context by key', async () => {
      const mockContexts: Record<string, SharedContext> = {
        'specific-key': {
          key: 'specific-key',
          value: { data: 'specific-value' },
          version: 1,
          updatedBy: 'agent1',
          timestamp: Date.now(),
        },
      };

      mockStorage.getContext.mockResolvedValue(mockContexts);

      const result = await contextService.getContext('specific-key');

      expect(result).toEqual({
        'specific-key': { data: 'specific-value' },
      });

      expect(mockStorage.getContext).toHaveBeenCalledWith('specific-key', undefined);
    });

    it('should get context by namespace', async () => {
      const mockContexts: Record<string, SharedContext> = {
        'ns-key': {
          key: 'ns-key',
          value: { data: 'ns-value' },
          version: 1,
          updatedBy: 'agent1',
          timestamp: Date.now(),
          namespace: 'test-namespace',
        },
      };

      mockStorage.getContext.mockResolvedValue(mockContexts);

      const result = await contextService.getContext(undefined, 'test-namespace');

      expect(result).toEqual({
        'ns-key': { data: 'ns-value' },
      });

      expect(mockStorage.getContext).toHaveBeenCalledWith(undefined, 'test-namespace');
    });

    it('should get context by both key and namespace', async () => {
      const mockContexts: Record<string, SharedContext> = {
        'filtered-key': {
          key: 'filtered-key',
          value: { data: 'filtered-value' },
          version: 1,
          updatedBy: 'agent1',
          timestamp: Date.now(),
          namespace: 'filtered-namespace',
        },
      };

      mockStorage.getContext.mockResolvedValue(mockContexts);

      const result = await contextService.getContext('filtered-key', 'filtered-namespace');

      expect(result).toEqual({
        'filtered-key': { data: 'filtered-value' },
      });

      expect(mockStorage.getContext).toHaveBeenCalledWith('filtered-key', 'filtered-namespace');
    });

    it('should return empty object when no contexts found', async () => {
      mockStorage.getContext.mockResolvedValue({});

      const result = await contextService.getContext();

      expect(result).toEqual({});
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage get error');

      mockStorage.getContext.mockRejectedValue(error);

      await expect(contextService.getContext()).rejects.toThrow('Storage get error');
    });
  });

  describe('getContextWithMetadata', () => {
    it('should return full context objects with metadata', async () => {
      const mockContexts: Record<string, SharedContext> = {
        key1: {
          key: 'key1',
          value: { data: 'value1' },
          version: 3,
          updatedBy: 'agent1',
          timestamp: 1700000000000,
          ttl: 3600000,
          namespace: 'test-ns',
        },
        key2: {
          key: 'key2',
          value: 'simple-value',
          version: 1,
          updatedBy: 'agent2',
          timestamp: 1700000001000,
        },
      };

      mockStorage.getContext.mockResolvedValue(mockContexts);

      const result = await contextService.getContextWithMetadata();

      expect(result).toEqual(mockContexts);
      expect(mockStorage.getContext).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should get context with metadata by key', async () => {
      const mockContexts: Record<string, SharedContext> = {
        'metadata-key': {
          key: 'metadata-key',
          value: { data: 'metadata-value' },
          version: 5,
          updatedBy: 'agent3',
          timestamp: 1700000002000,
          ttl: 7200000,
        },
      };

      mockStorage.getContext.mockResolvedValue(mockContexts);

      const result = await contextService.getContextWithMetadata('metadata-key');

      expect(result).toEqual(mockContexts);
      expect(mockStorage.getContext).toHaveBeenCalledWith('metadata-key', undefined);
    });

    it('should get context with metadata by namespace', async () => {
      const mockContexts: Record<string, SharedContext> = {
        'ns-metadata-key': {
          key: 'ns-metadata-key',
          value: { data: 'ns-metadata-value' },
          version: 2,
          updatedBy: 'agent4',
          timestamp: 1700000003000,
          namespace: 'metadata-namespace',
        },
      };

      mockStorage.getContext.mockResolvedValue(mockContexts);

      const result = await contextService.getContextWithMetadata(undefined, 'metadata-namespace');

      expect(result).toEqual(mockContexts);
      expect(mockStorage.getContext).toHaveBeenCalledWith(undefined, 'metadata-namespace');
    });

    it('should handle storage errors', async () => {
      const error = new Error('Metadata storage error');

      mockStorage.getContext.mockRejectedValue(error);

      await expect(contextService.getContextWithMetadata()).rejects.toThrow(
        'Metadata storage error',
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null values', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('null-key', null, 'agent1');

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          value: null,
        }),
      );
    });

    it('should handle undefined values', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('undefined-key', undefined, 'agent1');

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          value: undefined,
        }),
      );
    });

    it('should handle empty string keys', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('', 'empty-key-value', 'agent1');

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          key: '',
        }),
      );
    });

    it('should handle very long keys', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);
      const longKey = 'x'.repeat(1000);

      const result = await contextService.setContext(longKey, 'value', 'agent1');

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          key: longKey,
        }),
      );
    });

    it('should handle circular references in values', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const circularObject: any = { a: 1 };

      circularObject.self = circularObject;

      // This should either handle gracefully or throw a specific error
      // Depending on implementation, adjust expectation
      const result = await contextService.setContext('circular-key', circularObject, 'agent1');

      expect(result.success).toBe(true);
      // The storage layer should handle serialization
    });

    it('should handle concurrent context updates', async () => {
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      // Simulate concurrent updates by having different versions
      mockStorage.getContext
        .mockResolvedValueOnce({}) // First call
        .mockResolvedValueOnce({
          'concurrent-key': {
            key: 'concurrent-key',
            value: 'value1',
            version: 1,
            updatedBy: 'agent1',
            timestamp: mockTimestamp - 100,
          },
        }) // Second call
        .mockResolvedValueOnce({
          'concurrent-key': {
            key: 'concurrent-key',
            value: 'value2',
            version: 2,
            updatedBy: 'agent2',
            timestamp: mockTimestamp - 50,
          },
        }); // Third call

      mockStorage.saveContext.mockResolvedValue(undefined);

      // Simulate concurrent updates
      const promises = [
        contextService.setContext('concurrent-key', 'value-a', 'agentA'),
        contextService.setContext('concurrent-key', 'value-b', 'agentB'),
        contextService.setContext('concurrent-key', 'value-c', 'agentC'),
      ];

      const results = await Promise.all(promises);

      // All should succeed with incremented versions
      expect(results[0].success).toBe(true);
      expect(results[0].version).toBe(1);
      expect(results[1].success).toBe(true);
      expect(results[1].version).toBe(2);
      expect(results[2].success).toBe(true);
      expect(results[2].version).toBe(3);
    });

    it('should handle negative TTL values', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('negative-ttl', 'value', 'agent1', {
        ttl: -1000,
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          ttl: -1000,
        }),
      );
    });

    it('should handle special characters in namespace', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('special-key', 'value', 'agent1', {
        namespace: 'name/space:with@special#chars',
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: 'name/space:with@special#chars',
        }),
      );
    });

    it('should handle empty namespace', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const result = await contextService.setContext('empty-ns-key', 'value', 'agent1', {
        namespace: '',
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: '',
        }),
      );
    });

    it('should handle getContext when storage returns null', async () => {
      mockStorage.getContext.mockResolvedValue(null);

      const result = await contextService.getContext();

      expect(result).toEqual({});
    });

    it('should handle getContext when storage returns undefined', async () => {
      mockStorage.getContext.mockResolvedValue(undefined);

      const result = await contextService.getContext();

      expect(result).toEqual({});
    });

    it('should handle very large value objects', async () => {
      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      const largeValue = {
        data: Array(10000)
          .fill(0)
          .map((_, index) => ({
            index,
            value: 'x'.repeat(100),
          })),
      };

      const result = await contextService.setContext('large-value', largeValue, 'agent1');

      expect(result.success).toBe(true);
      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          value: largeValue,
        }),
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle context versioning across multiple updates', async () => {
      // Initial context
      mockStorage.getContext.mockResolvedValueOnce({});
      mockStorage.saveContext.mockResolvedValueOnce(undefined);

      // First update
      const result1 = await contextService.setContext('version-key', 'value1', 'agent1');

      expect(result1.version).toBe(1);

      // Mock existing context for second update
      const existingContext: SharedContext = {
        key: 'version-key',
        value: 'value1',
        version: 1,
        updatedBy: 'agent1',
        timestamp: Date.now() - 1000,
      };

      mockStorage.getContext.mockResolvedValueOnce({ 'version-key': existingContext });
      mockStorage.saveContext.mockResolvedValueOnce(undefined);

      // Second update
      const result2 = await contextService.setContext('version-key', 'value2', 'agent2');

      expect(result2.version).toBe(2);
    });

    it('should handle TTL expiration (via storage layer)', async () => {
      // This test verifies the service passes TTL correctly to storage
      // Actual TTL handling is done by the storage layer
      const mockTimestamp = 1700000000000;

      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockStorage.getContext.mockResolvedValue({});
      mockStorage.saveContext.mockResolvedValue(undefined);

      await contextService.setContext('ttl-key', 'ttl-value', 'agent1', { ttl: 1000 });

      expect(mockStorage.saveContext).toHaveBeenCalledWith(
        expect.objectContaining({
          ttl: 1000,
          timestamp: mockTimestamp,
        }),
      );
    });

    it('should preserve original context structure in getContextWithMetadata', async () => {
      const originalContext: SharedContext = {
        key: 'preserve-key',
        value: { complex: { data: ['array', 'values'] } },
        version: 42,
        updatedBy: 'original-agent',
        timestamp: 1699999999999,
        ttl: 999999,
        namespace: 'preserve-namespace',
      };

      mockStorage.getContext.mockResolvedValue({ 'preserve-key': originalContext });

      const result = await contextService.getContextWithMetadata();

      expect(result['preserve-key']).toEqual(originalContext);
      // Verify no mutation occurred
      expect(result['preserve-key']).toBe(originalContext);
    });
  });
});
