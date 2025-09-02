import { FeaturesService } from '~/features/service';
import { MessageService } from '~/messaging/service';
import { StorageAdapter } from '~/storage';

import { AgentRegistration } from '~/types';

export interface HubStatusResult {
  agents: {
    active: AgentRegistration[];
    inactive: AgentRegistration[];
    total: number;
  };
  features: {
    active: any[];
    byPriority: { critical: number; high: number; low: number; normal: number };
    total: number;
  };
  messages: {
    recentActivity: number;
    totalUnread: number;
  };
}

export class AgentService {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly featuresService: FeaturesService,
    private readonly messageService: MessageService,
  ) {}

  async getAllAgents(): Promise<AgentRegistration[]> {
    return this.storage.getAgents();
  }

  async getHubStatus(): Promise<HubStatusResult> {
    // Get all agent registration info
    const allAgents = await this.getAllAgents();

    // Separate active vs inactive agents (active = last seen within 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const activeAgents = allAgents.filter(agent => agent.lastSeen > fiveMinutesAgo);
    const inactiveAgents = allAgents.filter(agent => agent.lastSeen <= fiveMinutesAgo);

    // Get all features and categorize them
    const allFeatures = await this.featuresService.getFeatures();
    const activeFeatures = allFeatures.filter(feature => feature.status === 'active');

    const priorityCounts = {
      critical: allFeatures.filter(f => f.priority === 'critical').length,
      high: allFeatures.filter(f => f.priority === 'high').length,
      normal: allFeatures.filter(f => f.priority === 'normal').length,
      low: allFeatures.filter(f => f.priority === 'low').length,
    };

    // Get message activity overview
    const allMessages = await this.messageService.getAllMessages();
    const unreadMessages = allMessages.filter((message: any) => !message.read);

    // Messages from last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentMessages = allMessages.filter((message: any) => message.timestamp > oneHourAgo);

    return {
      agents: {
        total: allAgents.length,
        active: activeAgents,
        inactive: inactiveAgents,
      },
      features: {
        total: allFeatures.length,
        active: activeFeatures,
        byPriority: priorityCounts,
      },
      messages: {
        totalUnread: unreadMessages.length,
        recentActivity: recentMessages.length,
      },
    };
  }
}
