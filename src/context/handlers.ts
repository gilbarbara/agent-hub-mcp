import { validateContextValue, validateIdentifier } from '../validation.js';

import { ContextService } from './service.js';

export function createContextHandlers(contextService: ContextService) {
  return {
    async set_context(arguments_: any) {
      // Validate inputs
      const key = validateIdentifier(arguments_.key, 'key');
      const value = validateContextValue(arguments_.value);
      const agent = validateIdentifier(arguments_.agent, 'agent');
      const namespace = arguments_.namespace
        ? validateIdentifier(arguments_.namespace, 'namespace')
        : undefined;
      const ttl = arguments_.ttl ? Number(arguments_.ttl) : undefined;

      if (ttl !== undefined && (!Number.isFinite(ttl) || ttl < 0 || ttl > 86400000)) {
        throw new Error('TTL must be a positive number less than 24 hours');
      }

      const result = await contextService.setContext(key, value, agent, {
        ttl,
        namespace,
      });

      return result;
    },

    async get_context(arguments_: any) {
      // Validate inputs
      const key = arguments_.key ? validateIdentifier(arguments_.key, 'key') : undefined;
      const namespace = arguments_.namespace
        ? validateIdentifier(arguments_.namespace, 'namespace')
        : undefined;

      const result = await contextService.getContext(key, namespace);

      return result;
    },
  };
}
