export enum DelegationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
}

export enum FeaturePriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum FeatureStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ON_HOLD = 'on-hold',
  CANCELLED = 'cancelled',
}

export enum SubtaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
}

export enum TaskStatus {
  PLANNING = 'planning',
  APPROVED = 'approved',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
}

/**
 * Agent's work within a specific feature
 */
export interface AgentFeatureWork {
  feature: Feature;
  featureId: string;
  myDelegations: Delegation[];
  mySubtasks?: Subtask[];
}

/**
 * Agent's work across all features
 */
export interface AgentWorkload {
  activeFeatures: AgentFeatureWork[];
}

/**
 * Delegation creation input
 */
export interface CreateDelegationInput {
  agent: string;
  scope: string;
}

/**
 * Feature creation input
 */
export interface CreateFeatureInput {
  description: string;
  estimatedAgents?: string[];
  name: string;
  priority: FeaturePriority;
  title: string;
}

/**
 * Subtask creation input
 */
export interface CreateSubtaskInput {
  dependsOn?: string[];
  description?: string;
  title: string;
}

/**
 * Task creation input within a feature
 */
export interface CreateTaskInput {
  delegations: CreateDelegationInput[];
  description: string;
  title: string;
}

/**
 * Work assigned to specific agents within a feature
 */
export interface Delegation {
  acceptedAt?: number;
  agent: string;
  completedAt?: number;
  createdAt: number;
  id: string;
  parentTaskId: string;
  scope: string;
  status: DelegationStatus;
  subtaskIds: string[];
  updatedAt: number;
}

/**
 * Represents an epic or major feature that spans multiple repositories and agents
 */
export interface Feature {
  assignedAgents?: string[];
  createdAt: number;
  createdBy: string;
  description: string;
  estimatedAgents?: string[];
  id: string;
  name: string;
  priority: FeaturePriority;
  status: FeatureStatus;
  title: string;
  updatedAt: number;
}

/**
 * Complete feature data with all related entities
 */
export interface FeatureData {
  delegations: Delegation[];
  feature: Feature;
  subtasks: Subtask[];
  tasks: ParentTask[];
}

/**
 * Feature list filters
 */
export interface FeatureFilters {
  agent?: string;
  createdBy?: string;
  priority?: FeaturePriority;
  status?: FeatureStatus;
}

/**
 * Represents a major work item within a feature
 */
export interface ParentTask {
  approvedAt?: number;
  createdAt: number;
  createdBy: string;
  description: string;
  id: string;
  status: TaskStatus;
  title: string;
  updatedAt: number;
}

/**
 * Specific implementation work created by domain agents
 */
export interface Subtask {
  blockedReason?: string;
  createdAt: number;
  createdBy: string;
  delegationId: string;
  dependsOn: string[];
  description?: string;
  id: string;
  output?: string;
  parentTaskId: string;
  status: SubtaskStatus;
  title: string;
  updatedAt: number;
}

/**
 * Subtask update input
 */
export interface UpdateSubtaskInput {
  blockedReason?: string;
  output?: string;
  status?: SubtaskStatus;
}

/**
 * Priority ordering for features
 */
export const PRIORITY_ORDER: Record<FeaturePriority, number> = {
  [FeaturePriority.CRITICAL]: 0,
  [FeaturePriority.HIGH]: 1,
  [FeaturePriority.NORMAL]: 2,
  [FeaturePriority.LOW]: 3,
};
