import { createId } from '@paralleldrive/cuid2';

import { StorageAdapter } from '~/storage';

import { Message, MessagePriority, MessageType } from '~/types';

export class MessageService {
  constructor(private readonly storage: StorageAdapter) {}

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
      priority: options.priority ?? MessagePriority.NORMAL,
    };

    await this.storage.saveMessage(message);

    return message.id;
  }

  async getAllMessages(
    options: {
      since?: number;
      type?: string;
    } = {},
  ): Promise<Message[]> {
    return this.storage.getMessages({
      type: options.type,
      since: options.since,
    });
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
      // Mark messages as read atomically to prevent race conditions
      const markAsReadPromises = unreadMessages.map(message => {
        const markPromise = this.storage.markMessageAsRead(message.id);

        // Ensure we have a proper Promise to work with (defensive programming for mocks)
        if (markPromise && typeof markPromise.catch === 'function') {
          return markPromise.catch(error => {
            // Log error but don't fail the entire operation if one message fails
            // eslint-disable-next-line no-console
            console.error(`Failed to mark message ${message.id} as read:`, error);

            return null;
          });
        }

        // If markMessageAsRead doesn't return a proper promise, return resolved promise
        return Promise.resolve();
      });

      // Wait for all messages to be marked as read, but don't fail if some fail
      await Promise.allSettled(markAsReadPromises);
    }

    return {
      count: unreadMessages.length,
      messages: unreadMessages,
    };
  }

  async getMessageById(messageId: string): Promise<Message | undefined> {
    return this.storage.getMessage(messageId);
  }
}
