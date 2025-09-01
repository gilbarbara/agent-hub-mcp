import { FeaturesService } from '~/features/service';
import { MessageService } from '~/messaging/service';
import { StorageAdapter } from '~/storage';

import { AgentRegistration } from '~/types';

export interface AgentStatusResult {
  agents: AgentRegistration[];
  features: any;
  messages?: {
    totalCount: number;
    unreadCount: number;
  };
}

export class AgentService {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly featuresService: FeaturesService,
    private readonly messageService: MessageService,
  ) {}

  async getAgentStatus(agentId?: string): Promise<AgentStatusResult> {
    // Get agent registration info
    const agents = await this.storage.getAgents(agentId);

    // Get agent workload from features system
    const features = agentId
      ? await this.featuresService.getAgentWorkload(agentId)
      : { activeFeatures: [] };

    // Get message status if specific agent requested
    let messages;

    if (agentId) {
      try {
        const agentMessages = await this.messageService.getMessages(agentId, {
          markAsRead: false,
        });
        const unreadMessages = agentMessages.messages.filter(message => !message.read);

        messages = {
          unreadCount: unreadMessages.length,
          totalCount: agentMessages.messages.length,
        };
      } catch {
        // If error getting messages, don't fail the whole status call
        messages = {
          unreadCount: 0,
          totalCount: 0,
        };
      }
    }

    return {
      agents: agents ?? [],
      features,
      messages,
    };
  }
}
