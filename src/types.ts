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
