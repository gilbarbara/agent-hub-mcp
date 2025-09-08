import { AgentRegistration } from './agents.types';
import { Delegation, Feature } from './features.types';
import { Message } from './messages.types';

// Agent-specific notification function signature
export type AgentNotificationFunction = (
  agentId: string,
  method: NotificationMethod,
  params: NotificationParams[NotificationMethod],
) => Promise<void>;

// Broadcast notification function signature
export type BroadcastNotificationFunction = (
  method: NotificationMethod,
  params: NotificationParams[NotificationMethod],
) => Promise<void>;

// Union type for all notifications
export type Notification =
  | NewMessageNotification
  | AgentJoinedNotification
  | AgentRejoinedNotification
  | AgentLeftNotification
  | FeatureCreatedNotification
  | TaskCreatedNotification
  | DelegationAcceptedNotification
  | SubtaskUpdatedNotification
  | ResourceChangedNotification;

// Generic notification function signature
export type NotificationFunction<T extends NotificationMethod> = (
  method: T,
  params: NotificationParams[T],
) => Promise<void>;

// Notification method types
export type NotificationMethod =
  | 'new_message'
  | 'agent_joined'
  | 'agent_rejoined'
  | 'agent_left'
  | 'feature_created'
  | 'task_created'
  | 'delegation_accepted'
  | 'subtask_updated'
  | 'resource_changed';

export interface AgentJoinedNotification extends BaseNotification {
  method: 'agent_joined';
  params: {
    agent: AgentRegistration;
  };
}

export interface AgentLeftNotification extends BaseNotification {
  method: 'agent_left';
  params: {
    agent: AgentRegistration;
  };
}

export interface AgentRejoinedNotification extends BaseNotification {
  method: 'agent_rejoined';
  params: {
    agent: AgentRegistration;
  };
}

// Base notification interface
export interface BaseNotification {
  method: NotificationMethod;
  timestamp: number;
}

export interface DelegationAcceptedNotification extends BaseNotification {
  method: 'delegation_accepted';
  params: {
    agentId: string;
    delegationId: string;
    featureId: string;
  };
}

export interface FeatureCreatedNotification extends BaseNotification {
  method: 'feature_created';
  params: {
    feature: Feature;
  };
}

// Specific notification parameter types
export interface NewMessageNotification extends BaseNotification {
  method: 'new_message';
  params: {
    message: Message;
  };
}

// Notification parameter mapping
export interface NotificationParams {
  agent_joined: AgentJoinedNotification['params'];
  agent_left: AgentLeftNotification['params'];
  agent_rejoined: AgentRejoinedNotification['params'];
  delegation_accepted: DelegationAcceptedNotification['params'];
  feature_created: FeatureCreatedNotification['params'];
  new_message: NewMessageNotification['params'];
  resource_changed: ResourceChangedNotification['params'];
  subtask_updated: SubtaskUpdatedNotification['params'];
  task_created: TaskCreatedNotification['params'];
}

export interface ResourceChangedNotification extends BaseNotification {
  method: 'resource_changed';
  params: {
    uri: string;
  };
}

export interface SubtaskUpdatedNotification extends BaseNotification {
  method: 'subtask_updated';
  params: {
    featureId: string;
    status: string;
    subtaskId: string;
  };
}

export interface TaskCreatedNotification extends BaseNotification {
  method: 'task_created';
  params: {
    delegations: Delegation[];
    featureId: string;
    task: unknown;
  };
}
