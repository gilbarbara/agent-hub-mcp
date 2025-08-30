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
  SYNC_REQUEST = 'sync_request',
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

export interface SharedContext {
  key: string;
  namespace?: string;
  timestamp: number;
  ttl?: number;
  updatedBy: string;
  value: any;
  version: number;
}

export interface TaskStatus {
  agent: string;
  dependencies?: string[];
  details?: string;
  id: string;
  status: 'started' | 'in-progress' | 'completed' | 'blocked';
  task: string;
  timestamp: number;
}
