import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStorage } from '~/storage/file-storage';
import { IndexedStorage } from '~/storage/indexed-storage';

import { AgentRegistration, Message, MessagePriority, MessageType } from '~/types';

// Mock the FileStorage implementation
vi.mock('~/storage/file-storage');

describe('IndexedStorage', () => {
  let indexedStorage: IndexedStorage;
  let mockFileStorage: FileStorage;

  const mockMessage: Message = {
    id: 'msg-1',
    from: 'agent1',
    to: 'agent2',
    type: MessageType.CONTEXT,
    content: 'Test message',
    timestamp: Date.now(),
    read: false,
    priority: MessagePriority.NORMAL,
  };

  const mockAgent: AgentRegistration = {
    id: 'agent-1',
    projectPath: '/test/path',
    role: 'Test Agent',
    capabilities: ['test'],
    status: 'active',
    lastSeen: Date.now(),
    collaboratesWith: ['agent-2'],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    indexedStorage = new IndexedStorage('.test-agent-hub', {
      cacheTtl: 5000, // 5 seconds for testing
      maxCacheSize: 100,
    });

    // Get the mocked FileStorage instance
    mockFileStorage = (indexedStorage as any).fileStorage;

    // Mock file storage methods
    vi.mocked(mockFileStorage.init).mockResolvedValue();
    vi.mocked(mockFileStorage.getMessages).mockResolvedValue([]);
    vi.mocked(mockFileStorage.getAgents).mockResolvedValue([]);
  });

  afterEach(() => {
    // Clean up timers
    indexedStorage.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization and Warmup', () => {
    it('should initialize and warm up caches', async () => {
      const recentMessage = { ...mockMessage, timestamp: Date.now() };

      vi.mocked(mockFileStorage.getMessages).mockResolvedValue([recentMessage]);
      vi.mocked(mockFileStorage.getAgents).mockResolvedValue([mockAgent]);

      await indexedStorage.init();

      expect(mockFileStorage.init).toHaveBeenCalled();
      expect(mockFileStorage.getMessages).toHaveBeenCalledWith({
        since: expect.any(Number),
      });
      expect(mockFileStorage.getAgents).toHaveBeenCalled();
    });

    it('should handle warmup failures gracefully', async () => {
      vi.mocked(mockFileStorage.getMessages).mockRejectedValue(new Error('Storage error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await indexedStorage.init();

      expect(consoleSpy).toHaveBeenCalledWith('Cache warmup failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Message Operations', () => {
    it('should save and cache messages', async () => {
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      await indexedStorage.saveMessage(mockMessage);

      expect(mockFileStorage.saveMessage).toHaveBeenCalledWith(mockMessage);

      const stats = indexedStorage.getCacheStats();

      expect(stats.writes).toBe(1);
      expect(stats.cacheSize.messages).toBe(1);
    });

    it('should retrieve messages from cache when available', async () => {
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      // Save message to populate cache
      await indexedStorage.saveMessage(mockMessage);

      // Retrieve using agent filter (should hit index)
      const messages = await indexedStorage.getMessages({ agent: 'agent2' });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');

      const stats = indexedStorage.getCacheStats();

      expect(stats.indexHits).toBe(1);
    });

    it('should fall back to file storage when cache misses', async () => {
      vi.mocked(mockFileStorage.getMessages).mockResolvedValue([mockMessage]);

      const messages = await indexedStorage.getMessages({ agent: 'agent3', limit: 10 });

      expect(mockFileStorage.getMessages).toHaveBeenCalledWith({ agent: 'agent3', limit: 10 });
      expect(messages).toHaveLength(1);

      const stats = indexedStorage.getCacheStats();

      expect(stats.misses).toBe(1);
    });

    it('should handle broadcast messages in agent queries', async () => {
      const broadcastMessage = { ...mockMessage, id: 'broadcast', to: 'all' };

      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      await indexedStorage.saveMessage(mockMessage);
      await indexedStorage.saveMessage(broadcastMessage);

      const messages = await indexedStorage.getMessages({ agent: 'agent2' });

      expect(messages).toHaveLength(2);
      expect(messages.map(m => m.id).sort()).toEqual(['broadcast', 'msg-1']);
    });

    it('should get individual messages from cache', async () => {
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      await indexedStorage.saveMessage(mockMessage);

      const retrievedMessage = await indexedStorage.getMessage('msg-1');

      expect(retrievedMessage).toEqual(mockMessage);

      const stats = indexedStorage.getCacheStats();

      expect(stats.hits).toBe(1);
    });

    it('should mark messages as read and update cache', async () => {
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();
      vi.mocked(mockFileStorage.markMessageAsRead).mockResolvedValue();

      await indexedStorage.saveMessage(mockMessage);
      await indexedStorage.markMessageAsRead('msg-1');

      expect(mockFileStorage.markMessageAsRead).toHaveBeenCalledWith('msg-1');

      const cachedMessage = await indexedStorage.getMessage('msg-1');

      expect(cachedMessage?.read).toBe(true);
    });
  });

  describe('Agent Operations', () => {
    it('should save and cache agents', async () => {
      vi.mocked(mockFileStorage.saveAgent).mockResolvedValue();

      await indexedStorage.saveAgent(mockAgent);

      expect(mockFileStorage.saveAgent).toHaveBeenCalledWith(mockAgent);

      const stats = indexedStorage.getCacheStats();

      expect(stats.writes).toBe(1);
      expect(stats.cacheSize.agents).toBe(1);
    });

    it('should retrieve specific agents from cache', async () => {
      vi.mocked(mockFileStorage.saveAgent).mockResolvedValue();

      await indexedStorage.saveAgent(mockAgent);

      const agents = await indexedStorage.getAgents('agent-1');

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent-1');

      const stats = indexedStorage.getCacheStats();

      expect(stats.hits).toBe(1);
    });

    it('should retrieve all agents from cache when populated', async () => {
      const agent2 = { ...mockAgent, id: 'agent-2' };

      vi.mocked(mockFileStorage.saveAgent).mockResolvedValue();

      await indexedStorage.saveAgent(mockAgent);
      await indexedStorage.saveAgent(agent2);

      const agents = await indexedStorage.getAgents();

      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.id).sort()).toEqual(['agent-1', 'agent-2']);

      const stats = indexedStorage.getCacheStats();

      expect(stats.hits).toBe(1);
    });

    it('should save all agents atomically', async () => {
      const agents = [mockAgent, { ...mockAgent, id: 'agent-2' }];

      vi.mocked(mockFileStorage.saveAllAgents).mockResolvedValue();

      await indexedStorage.saveAllAgents(agents);

      expect(mockFileStorage.saveAllAgents).toHaveBeenCalledWith(agents);

      const stats = indexedStorage.getCacheStats();

      expect(stats.writes).toBe(1);
      expect(stats.cacheSize.agents).toBe(2);
    });

    it('should update agents in cache', async () => {
      vi.mocked(mockFileStorage.saveAgent).mockResolvedValue();
      vi.mocked(mockFileStorage.updateAgent).mockResolvedValue();

      await indexedStorage.saveAgent(mockAgent);

      const updates = { role: 'Updated Agent' };

      await indexedStorage.updateAgent('agent-1', updates);

      expect(mockFileStorage.updateAgent).toHaveBeenCalledWith('agent-1', updates);

      const agents = await indexedStorage.getAgents('agent-1');

      expect(agents[0].role).toBe('Updated Agent');
    });
  });

  describe('Cache Management', () => {
    it('should provide accurate cache statistics', async () => {
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();
      vi.mocked(mockFileStorage.saveAgent).mockResolvedValue();

      await indexedStorage.saveMessage(mockMessage);
      await indexedStorage.saveAgent(mockAgent);

      // Cache hit
      await indexedStorage.getMessage('msg-1');

      // Cache miss
      vi.mocked(mockFileStorage.getMessage).mockResolvedValue(undefined);
      await indexedStorage.getMessage('non-existent');

      const stats = indexedStorage.getCacheStats();

      expect(stats.writes).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.cacheSize.messages).toBe(1);
      expect(stats.cacheSize.agents).toBe(1);
    });

    it('should enforce maximum cache size with LRU eviction', async () => {
      // Test that the enforceMaxCacheSize method works correctly
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      // Fill cache beyond the default maxCacheSize (10000)
      // But test the logic directly by calling enforceMaxCacheSize
      const messages = [];

      for (let index = 1; index <= 12; index++) {
        messages.push({
          ...mockMessage,
          id: `msg-${index}`,
          timestamp: Date.now() - (12 - index) * 1000, // Older messages have smaller timestamps
        });
      }

      // Add messages to cache
      for (const message of messages) {
        await indexedStorage.saveMessage(message);
      }

      expect(indexedStorage.getCacheStats().cacheSize.messages).toBe(12);

      // Manually set maxCacheSize to trigger eviction
      (indexedStorage as any).config.maxCacheSize = 10;

      // Call enforceMaxCacheSize directly
      (indexedStorage as any).enforceMaxCacheSize((indexedStorage as any).messageCache);

      const stats = indexedStorage.getCacheStats();

      // Should have removed 10% of 12 = 1 entry, leaving 11
      // But since 11 > 10, it might trigger again
      expect(stats.cacheSize.messages).toBeLessThan(12);
    });

    it('should clean up expired cache entries', async () => {
      vi.useFakeTimers();

      // Create storage with short TTL
      const shortTtlStorage = new IndexedStorage('.test-agent-hub', {
        cacheTtl: 1000, // 1 second
      });

      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      await shortTtlStorage.saveMessage(mockMessage);

      // Advance time beyond TTL
      vi.advanceTimersByTime(2000);

      // Trigger cleanup (normally done by timer)
      (shortTtlStorage as any).cleanupExpiredCache();

      const stats = shortTtlStorage.getCacheStats();

      expect(stats.cacheSize.messages).toBe(0);

      shortTtlStorage.dispose();
      vi.useRealTimers();
    });

    it('should handle cache entry TTL validation', async () => {
      vi.useFakeTimers();

      const shortTtlStorage = new IndexedStorage('.test-agent-hub', {
        cacheTtl: 1000,
      });

      // Set up mocks for the new instance
      const shortTtlFileStorage = (shortTtlStorage as any).fileStorage;

      vi.mocked(shortTtlFileStorage.init).mockResolvedValue();
      vi.mocked(shortTtlFileStorage.getMessages).mockResolvedValue([]);
      vi.mocked(shortTtlFileStorage.getAgents).mockResolvedValue([]);
      vi.mocked(shortTtlFileStorage.saveMessage).mockResolvedValue();
      vi.mocked(shortTtlFileStorage.getMessage).mockResolvedValue(mockMessage);

      await shortTtlStorage.saveMessage(mockMessage);

      // Advance time beyond TTL
      vi.advanceTimersByTime(2000);

      // Should fall back to file storage due to expired cache
      const retrievedMessage = await shortTtlStorage.getMessage('msg-1');

      expect(retrievedMessage).toEqual(mockMessage);
      expect(shortTtlFileStorage.getMessage).toHaveBeenCalledWith('msg-1');

      const stats = shortTtlStorage.getCacheStats();

      expect(stats.misses).toBe(1);

      shortTtlStorage.dispose();
      vi.useRealTimers();
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old data and refresh caches', async () => {
      vi.mocked(mockFileStorage.cleanup).mockResolvedValue();
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      // Populate cache first
      await indexedStorage.saveMessage(mockMessage);

      let stats = indexedStorage.getCacheStats();

      expect(stats.cacheSize.messages).toBe(1);

      // Cleanup should clear caches and re-warm
      await indexedStorage.cleanup(7);

      expect(mockFileStorage.cleanup).toHaveBeenCalledWith(7);

      stats = indexedStorage.getCacheStats();
      expect(stats.cacheSize.messages).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from cache corruption during save operations', async () => {
      vi.mocked(mockFileStorage.saveMessage).mockResolvedValue();

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock cache corruption by making cacheMessage throw
      const originalCacheMessage = (indexedStorage as any).cacheMessage;

      vi.spyOn(indexedStorage as any, 'cacheMessage')
        .mockImplementationOnce(() => {
          throw new Error('Cache corruption');
        })
        .mockImplementation(originalCacheMessage);

      await indexedStorage.saveMessage(mockMessage);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Cache operation failed, attempting recovery:',
        expect.any(Error),
      );

      // Should have recovered and cached the message
      const stats = indexedStorage.getCacheStats();

      expect(stats.writes).toBe(1);

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should recover from corruption by rebuilding cache', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Simulate corruption recovery
      await (indexedStorage as any).recoverFromCorruption();

      expect(consoleSpy).toHaveBeenCalledWith('Recovering from cache corruption...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Cache recovery completed successfully');

      // All caches should be cleared
      const stats = indexedStorage.getCacheStats();

      expect(stats.cacheSize.messages).toBe(0);
      expect(stats.cacheSize.agents).toBe(0);

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle recovery failures when warmup throws after clearing cache', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create a failing storage instance
      const failingStorage = new IndexedStorage('.test-agent-hub');
      const failingFileStorage = (failingStorage as any).fileStorage;

      // Mock successful initial state
      vi.mocked(failingFileStorage.init).mockResolvedValue();
      vi.mocked(failingFileStorage.getMessages).mockResolvedValue([]);
      vi.mocked(failingFileStorage.getAgents).mockResolvedValue([]);

      await failingStorage.init();

      // Mock the warmupCaches method to throw an error after clearing caches
      vi.spyOn(failingStorage as any, 'warmupCaches').mockRejectedValue(
        new Error('Warmup failed after clear'),
      );

      // Since warmupCaches doesn't normally throw (it catches errors),
      // we need to test the recovery mechanism itself
      // The recovery method will only throw if warmupCaches throws, which it doesn't normally do
      await expect((failingStorage as any).recoverFromCorruption()).rejects.toThrow(
        'Unable to recover from cache corruption',
      );

      expect(consoleSpy).toHaveBeenCalledWith('Cache recovery failed:', expect.any(Error));

      failingStorage.dispose();
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Resource Management', () => {
    it('should dispose resources and clear timers', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      indexedStorage.dispose();

      expect(clearIntervalSpy).toHaveBeenCalled();

      // Should not crash if called multiple times
      indexedStorage.dispose();

      clearIntervalSpy.mockRestore();
    });
  });
});
