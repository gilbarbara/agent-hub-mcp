import {
  CreateFeatureInput,
  CreateSubtaskInput,
  CreateTaskInput,
  FeaturePriority,
  UpdateSubtaskInput,
} from './features.types';
import { MessagePriority, MessageType } from './messages.types';

// Union type for all tool inputs
export type ToolInput =
  | RegisterAgentInput
  | SendMessageInput
  | GetMessagesInput
  | CreateFeatureInput
  | CreateTaskInput
  | CreateSubtaskInput
  | GetFeaturesInput
  | GetFeatureInput
  | AcceptDelegationInput
  | UpdateSubtaskInput
  | SyncInput;

export interface AcceptDelegationInput {
  agentId: string;
  delegationId: string;
  featureId: string;
}

export interface GetFeatureInput {
  featureId: string;
}

export interface GetFeaturesInput {
  agent?: string;
  createdBy?: string;
  priority?: FeaturePriority;
  status?: string;
}

export interface GetMessagesInput {
  agent: string;
  limit?: number;
  markAsRead?: boolean;
  offset?: number;
  since?: number;
  type?: MessageType;
}

// Agent-related tool inputs
export interface RegisterAgentInput {
  capabilities?: string[];
  collaboratesWith?: string[];
  id?: string;
  projectPath: string;
  role: string;
}

// Messaging tool inputs
export interface SendMessageInput {
  content: string;
  from: string;
  metadata?: Record<string, unknown>;
  priority?: MessagePriority;
  threadId?: string;
  to: string;
  type: MessageType;
}

export interface SyncInput {
  agentId: string;
  markAsRead?: boolean;
}

export interface ToolInputMap {
  accept_delegation: AcceptDelegationInput;
  create_feature: CreateFeatureInput;
  create_subtask: CreateSubtaskInput;
  create_task: CreateTaskInput;
  get_feature: GetFeatureInput;
  get_features: GetFeaturesInput;
  get_hub_status: Record<string, never>;
  get_messages: GetMessagesInput;
  register_agent: RegisterAgentInput;
  send_message: SendMessageInput;
  sync: SyncInput;
  update_subtask: UpdateSubtaskInput;
}
