export enum MessagePriority {
  URGENT = 'urgent',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum MessageType {
  CONTEXT = 'context',
  TASK = 'task',
  QUESTION = 'question',
  COMPLETION = 'completion',
  ERROR = 'error',
}

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

export interface Message {
  content: string;
  from: string;
  id: string;
  metadata?: Record<string, any>;
  priority?: MessagePriority;
  read: boolean;
  threadId?: string;
  timestamp: number;
  to: 'all' | (string & {});
  type: MessageType;
}

export interface MessagesResponse {
  count: number;
  messages: Message[];
}

export interface SyncErrorResult {
  error: string;
  success: false;
  timestamp: number;
}

export interface SyncResult {
  hubStatus: any; // HubStatusResult type from agents/service.ts
  messages: {
    count: number;
    messages: Message[];
  };
  success: boolean;
  timestamp: number;
  workload: SyncWorkloadResult;
}

export interface SyncWorkloadResult {
  activeFeatures: any[]; // Using AgentFeatureWork[] from features/types.ts would create circular import
  success: boolean;
  summary: WorkloadSummary;
}

export interface WorkloadSummary {
  featuresByPriority: Record<string, number>;
  totalDelegations: number;
  totalFeatures: number;
}
