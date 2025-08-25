import { createId } from '@paralleldrive/cuid2';

import { FileStorage } from '../storage.js';
import { Message, MessagePriority, MessageType } from '../types.js';

export class MessageService {
  constructor(private readonly storage: FileStorage) {}

  async sendMessage(
    from: string,
    to: string,
    type: MessageType,
    content: string,
    options: {
      metadata?: Record<string, any>;
      priority?: MessagePriority;
      threadId?: string;
    } = {},
  ): Promise<string> {
    const message: Message = {
      id: createId(),
      from,
      to,
      type,
      content,
      metadata: options.metadata,
      timestamp: Date.now(),
      read: false,
      threadId: options.threadId,
      priority: options.priority || MessagePriority.NORMAL,
    };

    await this.storage.saveMessage(message);

    return message.id;
  }

  async getMessages(
    agentId: string,
    options: {
      markAsRead?: boolean;
      since?: number;
      type?: string;
    } = {},
  ): Promise<{ count: number; messages: Message[] }> {
    const messages = await this.storage.getMessages({
      agent: agentId,
      type: options.type,
      since: options.since,
    });

    const unreadMessages = messages.filter(m => !m.read && (m.to === agentId || m.to === 'all'));

    if (options.markAsRead !== false) {
      for (const message of unreadMessages) {
        await this.storage.markMessageAsRead(message.id);
      }
    }

    return {
      count: unreadMessages.length,
      messages: unreadMessages,
    };
  }

  async sendSyncRequest(
    from: string,
    to: string,
    topic: string,
    timeout = 30000,
  ): Promise<{ response?: string; timeout?: boolean }> {
    const syncMessage: Message = {
      id: createId(),
      from,
      to,
      type: MessageType.SYNC_REQUEST,
      content: topic,
      timestamp: Date.now(),
      read: false,
      priority: MessagePriority.URGENT,
    };

    await this.storage.saveMessage(syncMessage);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => {
        setTimeout(resolve, 1000);
      });

      const responses = await this.storage.getMessages({
        agent: from,
        since: syncMessage.timestamp,
      });

      const response = responses.find(m => m.from === to && m.threadId === syncMessage.id);

      if (response) {
        return { response: response.content };
      }
    }

    return { timeout: true };
  }

  async getMessageById(messageId: string): Promise<Message | undefined> {
    return this.storage.getMessage(messageId);
  }
}
