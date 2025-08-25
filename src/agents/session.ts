import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { AgentRegistration } from '../types.js';

export interface AgentSession {
  agent: AgentRegistration | null;
  server: Server;
  transport: StreamableHTTPServerTransport;
}

export class SessionManager {
  private readonly sessions = new Map<string, AgentSession>();

  get(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, session: AgentSession): void {
    this.sessions.set(sessionId, session);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  size(): number {
    return this.sessions.size;
  }

  getAll(): AgentSession[] {
    return [...this.sessions.values()];
  }

  getSessions(): Map<string, AgentSession> {
    return this.sessions;
  }
}
