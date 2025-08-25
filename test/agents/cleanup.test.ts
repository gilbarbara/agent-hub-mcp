import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentStatusCleanup } from '../../src/agents/cleanup.js';
import { FileStorage } from '../../src/storage.js';
import { AgentRegistration } from '../../src/types.js';

describe('AgentStatusCleanup', () => {
  let storage: FileStorage;
  let cleanup: AgentStatusCleanup;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let tempDirectory: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-hub-test-'));
    storage = new FileStorage(tempDirectory);
    await storage.init(); // Initialize the directory structure
    cleanup = new AgentStatusCleanup(storage);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(async () => {
    cleanup.stopPeriodicCleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Clean up temp directory
    try {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should mark agents as offline when lastSeen is older than 5 minutes', async () => {
    const now = Date.now();
    const sixMinutesAgo = now - 6 * 60 * 1000;

    const activeAgent: AgentRegistration = {
      id: 'test-agent',
      projectPath: '/test',
      role: 'test',
      capabilities: [],
      status: 'active',
      lastSeen: sixMinutesAgo,
      collaboratesWith: [],
    };

    await storage.init();
    await storage.saveAgent(activeAgent);

    await cleanup.updateAgentStatuses();

    const agents = await storage.getAgents();

    expect(agents[0].status).toBe('offline');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent test-agent marked as offline'),
    );
  });

  it('should mark agents as active when lastSeen is within 5 minutes', async () => {
    const now = Date.now();
    const fourMinutesAgo = now - 4 * 60 * 1000;

    const offlineAgent: AgentRegistration = {
      id: 'test-agent',
      projectPath: '/test',
      role: 'test',
      capabilities: [],
      status: 'offline',
      lastSeen: fourMinutesAgo,
      collaboratesWith: [],
    };

    await storage.init();
    await storage.saveAgent(offlineAgent);

    await cleanup.updateAgentStatuses();

    const agents = await storage.getAgents();

    expect(agents[0].status).toBe('active');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent test-agent marked as active'),
    );
  });

  it('should not change status when already correct', async () => {
    const now = Date.now();
    const fourMinutesAgo = now - 4 * 60 * 1000;

    const activeAgent: AgentRegistration = {
      id: 'test-agent',
      projectPath: '/test',
      role: 'test',
      capabilities: [],
      status: 'active',
      lastSeen: fourMinutesAgo,
      collaboratesWith: [],
    };

    await storage.init();
    await storage.saveAgent(activeAgent);

    await cleanup.updateAgentStatuses();

    const agents = await storage.getAgents();

    expect(agents[0].status).toBe('active');
    // Should not log any status change
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('marked as'));
  });

  it('should handle storage errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(storage, 'getAgents').mockRejectedValue(new Error('Storage error'));

    await cleanup.updateAgentStatuses();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error updating agent statuses:',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should start and stop periodic cleanup', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    cleanup.startPeriodicCleanup();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2 * 60 * 1000);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent status cleanup started'),
    );

    cleanup.stopPeriodicCleanup();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Agent status cleanup stopped');
  });
});
