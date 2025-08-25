import { FileStorage } from '../storage.js';

export class AgentStatusCleanup {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  constructor(private readonly storage: FileStorage) {}

  /**
   * Updates agent statuses based on lastSeen timestamps
   * Agents are marked offline if they haven't been seen in 5 minutes
   */
  async updateAgentStatuses(): Promise<void> {
    try {
      const agents = await this.storage.getAgents();
      const now = Date.now();
      const threshold = now - this.OFFLINE_THRESHOLD_MS;

      for (const agent of agents) {
        const shouldBeOffline = agent.lastSeen < threshold;

        if (agent.status === 'active' && shouldBeOffline) {
          await this.storage.updateAgent(agent.id, { status: 'offline' });
          // eslint-disable-next-line no-console
          console.log(
            `Agent ${agent.id} marked as offline (last seen: ${new Date(agent.lastSeen).toISOString()})`,
          );
        } else if (agent.status === 'offline' && !shouldBeOffline) {
          // If an agent comes back online, mark them as active
          await this.storage.updateAgent(agent.id, { status: 'active' });
          // eslint-disable-next-line no-console
          console.log(
            `Agent ${agent.id} marked as active (last seen: ${new Date(agent.lastSeen).toISOString()})`,
          );
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error updating agent statuses:', error);
    }
  }

  /**
   * Start periodic status cleanup
   */
  startPeriodicCleanup(): void {
    if (this.intervalId) {
      return; // Already running
    }

    // Run immediately on start
    this.updateAgentStatuses();

    // Then run every 2 minutes
    this.intervalId = setInterval(() => {
      this.updateAgentStatuses();
    }, this.CLEANUP_INTERVAL_MS);

    // eslint-disable-next-line no-console
    console.log(`Agent status cleanup started (runs every ${this.CLEANUP_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Stop periodic status cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;

      // eslint-disable-next-line no-console
      console.log('Agent status cleanup stopped');
    }
  }
}
