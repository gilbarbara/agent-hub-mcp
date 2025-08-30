import { validateContextValue, validateIdentifier, validateString } from '~/validation';

import { ContextService } from './service';

export function createContextHandlers(contextService: ContextService) {
  return {
    async set_context(arguments_: any) {
      // Validate inputs - allow colons in context keys for namespacing
      const key = validateString(arguments_.key, 'key', {
        required: true,
        maxLength: 200,
        pattern: /^[\w:-]+$/,
      });
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
      // Validate inputs - allow colons in context keys for namespacing
      const key = arguments_.key
        ? validateString(arguments_.key, 'key', {
            required: false,
            maxLength: 200,
            pattern: /^[\w:-]+$/,
          })
        : undefined;
      const namespace = arguments_.namespace
        ? validateIdentifier(arguments_.namespace, 'namespace')
        : undefined;

      const result = await contextService.getContext(key, namespace);

      return result;
    },
  };
}
