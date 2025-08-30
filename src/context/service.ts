import { FileStorage } from '../storage';
import { SharedContext } from '../types';

export class ContextService {
  constructor(private readonly storage: FileStorage) {}

  async setContext(
    key: string,
    value: any,
    agent: string,
    options: {
      namespace?: string;
      ttl?: number;
    } = {},
  ): Promise<{ success: boolean; version: number }> {
    const existingContexts = await this.storage.getContext(key);
    const existingContext = existingContexts[key];

    const context: SharedContext = {
      key,
      value,
      version: existingContext ? existingContext.version + 1 : 1,
      updatedBy: agent,
      timestamp: Date.now(),
      ttl: options.ttl,
      namespace: options.namespace,
    };

    await this.storage.saveContext(context);

    return { success: true, version: context.version };
  }

  async getContext(key?: string, namespace?: string): Promise<Record<string, any>> {
    const contexts = await this.storage.getContext(key, namespace);
    const result: Record<string, any> = {};

    for (const [contextKey, context] of Object.entries(contexts)) {
      result[contextKey] = context.value;
    }

    return result;
  }

  async getContextWithMetadata(
    key?: string,
    namespace?: string,
  ): Promise<Record<string, SharedContext>> {
    return this.storage.getContext(key, namespace);
  }
}
