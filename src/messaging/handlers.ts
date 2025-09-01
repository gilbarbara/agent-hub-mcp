import { StorageAdapter } from '~/storage';
import {
  validateIdentifier,
  validateMessagePriority,
  validateMessageType,
  validateMetadata,
  validateString,
} from '~/validation';

import { MessageService } from './service';

export function createMessageHandlers(
  messageService: MessageService,
  storage: StorageAdapter,
  sendNotificationToAgent: (agentId: string, method: string, params: any) => Promise<void>,
  sendResourceNotification?: (agentId: string, uri: string) => Promise<void>,
) {
  return {
    async send_message(arguments_: any) {
      // Validate all inputs
      const from = validateIdentifier(arguments_.from, 'from');
      const to = validateIdentifier(arguments_.to, 'to');
      const type = validateMessageType(arguments_.type);
      const content = validateString(arguments_.content, 'content', { maxLength: 10000 });
      const metadata = validateMetadata(arguments_.metadata);
      const priority = validateMessagePriority(arguments_.priority);
      const threadId = arguments_.threadId
        ? validateIdentifier(arguments_.threadId, 'threadId')
        : undefined;

      const messageId = await messageService.sendMessage(from, to, type, content, {
        metadata,
        priority,
        threadId,
      });

      // Trigger notification to target agent
      if (to !== 'all') {
        const message = await messageService.getMessageById(messageId);

        if (message) {
          // Send traditional notification
          await sendNotificationToAgent(to, 'new_message', { message });

          // Send resource change notification so Claude Code re-reads the message resource
          if (sendResourceNotification) {
            await sendResourceNotification(to, `agent-hub://messages/${to}`);
          }
        }
      } else {
        // Handle broadcast messages
        const agents = await storage.getAgents();
        const message = await messageService.getMessageById(messageId);

        if (message) {
          for (const agent of agents) {
            if (agent.id !== arguments_.from) {
              await sendNotificationToAgent(agent.id, 'new_message', { message });

              // Send resource change notification for each recipient
              if (sendResourceNotification) {
                await sendResourceNotification(agent.id, `agent-hub://messages/${agent.id}`);
              }
            }
          }
        }
      }

      return { success: true, messageId };
    },

    async get_messages(arguments_: any) {
      const result = await messageService.getMessages(arguments_.agent as string, {
        type: arguments_.type as string,
        since: arguments_.since as number,
        markAsRead: arguments_.markAsRead,
      });

      return result;
    },
  };
}
