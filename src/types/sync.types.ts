import { HubStatusResult } from './agents.types';
import { AgentFeatureWork } from './features.types';
import { Message } from './messages.types';

export interface SyncErrorResult {
  error: string;
  success: false;
  timestamp: number;
}

export interface SyncResult {
  hubStatus: HubStatusResult;
  messages: {
    count: number;
    messages: Message[];
  };
  success: boolean;
  timestamp: number;
  workload: SyncWorkloadResult;
}

export interface SyncWorkloadResult {
  activeFeatures: AgentFeatureWork[];
  success: boolean;
  summary: WorkloadSummary;
}

export interface WorkloadSummary {
  featuresByPriority: Record<string, number>;
  totalDelegations: number;
  totalFeatures: number;
}
