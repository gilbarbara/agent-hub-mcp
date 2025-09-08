/* eslint-disable no-console */
import { Server } from '@modelcontextprotocol/sdk/server';

import { AgentSession } from '~/agents/session';

/**
 * Service for managing notifications via MCP's built-in notification system
 */
export class NotificationService {
  private sessions: Map<string, AgentSession>;

  constructor(sessions: Map<string, AgentSession>) {
    this.sessions = sessions;
  }

  /**
   * Broadcast a resource list change to all connected agents
   */
  async broadcastResourceListChanged(): Promise<void> {
    console.log(`📡 Broadcasting resources/list_changed to ${this.sessions.size} agents`);

    const promises: Promise<void>[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.server && session.agent) {
        console.log(`  → Notifying session ${sessionId} (${session.agent.id})`);
        promises.push(this.sendResourceListChanged(session.server));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Send resource list changed notification to a specific agent
   */
  async sendResourceListChangedToAgent(agentId: string): Promise<void> {
    const session = this.findSessionByAgentId(agentId);

    if (session?.server) {
      console.log(`📤 Sending resources/list_changed to agent ${agentId}`);
      await this.sendResourceListChanged(session.server);
    } else {
      console.log(`⚠️ Agent ${agentId} not found or no server connection`);
    }
  }

  /**
   * Send notification that a specific resource has changed
   * This will cause Claude Code to re-read the resource
   */
  async sendResourceChangedNotification(agentId: string, resourceUri: string): Promise<void> {
    const session = this.findSessionByAgentId(agentId);

    if (session?.server) {
      console.log(`🔄 Sending resource changed notification to ${agentId} for ${resourceUri}`);
      // Use the standard MCP resources/list_changed notification
      // Claude Code will then re-read all resources including the changed one
      await this.sendResourceListChanged(session.server);
    } else {
      console.log(`⚠️ Agent ${agentId} not found for resource notification`);
    }
  }

  /**
   * Broadcast a tool list change to all connected agents
   */
  async broadcastToolListChanged(): Promise<void> {
    console.log(`📡 Broadcasting tools/list_changed to ${this.sessions.size} agents`);

    const promises: Promise<void>[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.server && session.agent) {
        console.log(`  → Notifying session ${sessionId} (${session.agent.id})`);
        promises.push(this.sendToolListChanged(session.server));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Send a custom notification to a specific agent
   */
  async sendNotificationToAgent(agentId: string, method: string, params?: unknown): Promise<void> {
    console.log(`📤 Sending ${method} to agent ${agentId}`);

    const session = this.findSessionByAgentId(agentId);

    if (!session?.server) {
      console.log(`⚠️ Agent ${agentId} not found or no server connection`);

      return;
    }

    // Send notifications with actual content
    switch (method) {
      case 'new_message': {
        // Send the actual message content via SSE
        const p = params as any;

        if (p?.message) {
          console.log(`  → Delivering message: ${p.message.id}`);
          await this.sendCustomNotification(session.server, 'new_message', {
            message: p.message,
          });
        }

        // Also trigger resource list change for compatibility
        await this.sendResourceListChanged(session.server);
        break;
      }

      case 'context_updated':
      case 'task_updated':
        await this.sendCustomNotification(session.server, method, params);
        await this.sendResourceListChanged(session.server);
        break;
      case 'agent_joined':
      case 'agent_left':
      case 'agent_updated':
        await this.sendCustomNotification(session.server, method, params);
        await this.sendResourceListChanged(session.server);
        await this.sendToolListChanged(session.server);
        break;
      default:
        console.log(`  → Unknown notification type: ${method}`);
    }
  }

  /**
   * Broadcast a notification to all connected agents
   */
  async broadcastNotification(method: string, _params?: unknown): Promise<void> {
    console.log(`📡 Broadcasting ${method} to ${this.sessions.size} agents`);

    // Map to appropriate MCP notification
    switch (method) {
      case 'new_message':
      case 'context_updated':
      case 'task_updated':
      case 'agent_joined':
      case 'agent_left':
      case 'agent_updated':
        await this.broadcastResourceListChanged();
        break;
      default:
        console.log(`  → Unknown broadcast type: ${method}`);
    }
  }

  /**
   * Send resource list changed notification via MCP server
   */
  private async sendResourceListChanged(server: Server): Promise<void> {
    try {
      await server.sendResourceListChanged();
    } catch (error) {
      console.error('Error sending resource list changed:', error);
    }
  }

  /**
   * Send tool list changed notification via MCP server
   */
  private async sendToolListChanged(server: Server): Promise<void> {
    try {
      await server.sendToolListChanged();
    } catch (error) {
      console.error('Error sending tool list changed:', error);
    }
  }

  /**
   * Log custom notification (MCP Server only supports specific notification types)
   */
  private async sendCustomNotification(
    _server: Server,
    method: string,
    params: unknown,
  ): Promise<void> {
    try {
      console.log(
        `  → Custom notification ${method} with params:`,
        JSON.stringify(params, null, 2),
      );
      // MCP Server doesn't have a generic sendNotification method
      // We can only use built-in notifications like sendResourceListChanged
      // For now, we log the custom notification and rely on resource list changes
    } catch (error) {
      console.error(`Error processing custom notification ${method}:`, error);
    }
  }

  /**
   * Find session by agent ID
   */
  private findSessionByAgentId(agentId: string): AgentSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.agent && session.agent.id === agentId) {
        return session;
      }
    }

    return undefined;
  }

  /**
   * Update sessions map reference (for when SessionManager updates)
   */
  updateSessions(sessions: Map<string, AgentSession>): void {
    this.sessions = sessions;
  }
}
