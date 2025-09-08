import { Feature } from './features.types';

export interface AgentRegistration {
  capabilities: string[];
  collaboratesWith: string[];
  id: string;
  lastSeen: number;
  metadata?: Record<string, any>;
  projectPath: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
}

export interface HubStatusResult {
  agents: {
    active: AgentRegistration[];
    inactive: AgentRegistration[];
    total: number;
  };
  features: {
    active: Feature[];
    byPriority: { critical: number; high: number; low: number; normal: number };
    total: number;
  };
  messages: {
    recentActivity: number;
    totalUnread: number;
  };
}
