import { AuditableEntity, FilterOptions, StatusEntity } from './common.types';

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
 * Feature list filters
 */
export type FeatureFilters = FilterOptions<Pick<Feature, 'status' | 'priority' | 'createdBy'>> & {
  agent?: string;
};

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
  createdBy: string;
  description: string;
  estimatedAgents?: string[];
  name: string;
  priority?: FeaturePriority;
  title: string;
}

/**
 * Subtask creation input (for MCP tool)
 */
export interface CreateSubtaskInput {
  createdBy: string;
  delegationId: string;
  featureId: string;
  subtasks: SubtaskData[];
}

/**
 * Subtask creation input (for service method)
 */
export interface CreateSubtaskServiceInput {
  dependsOn?: string[];
  description?: string;
  title: string;
}

/**
 * Task creation input within a feature
 */
export interface CreateTaskInput {
  createdBy: string;
  delegations: Array<{
    agent: string;
    scope: string;
  }>;
  description: string;
  featureId: string;
  title: string;
}

/**
 * Work assigned to specific agents within a feature
 */
export interface Delegation extends AuditableEntity, StatusEntity<DelegationStatus> {
  acceptedAt?: number;
  agent: string;
  completedAt?: number;
  parentTaskId: string;
  scope: string;
  subtaskIds: string[];
}

/**
 * Represents an epic or major feature that spans multiple repositories and agents
 */
export interface Feature extends AuditableEntity, StatusEntity<FeatureStatus> {
  assignedAgents?: string[];
  description: string;
  estimatedAgents?: string[];
  name: string;
  priority: FeaturePriority;
  title: string;
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
 * Represents a major work item within a feature
 */
export interface ParentTask extends AuditableEntity, StatusEntity<TaskStatus> {
  approvedAt?: number;
  description: string;
  title: string;
}

/**
 * Specific implementation work created by domain agents
 */
export interface Subtask extends AuditableEntity, StatusEntity<SubtaskStatus> {
  blockedReason?: string;
  delegationId: string;
  dependsOn: string[];
  description?: string;
  output?: string;
  parentTaskId: string;
  title: string;
}

/**
 * Individual subtask data for creation
 */
export interface SubtaskData {
  dependsOn?: string[];
  description?: string;
  title: string;
}

/**
 * Subtask update input
 */
export interface UpdateSubtaskInput {
  blockedReason?: string;
  featureId: string;
  output?: string;
  status?: SubtaskStatus;
  subtaskId: string;
  updatedBy: string;
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
