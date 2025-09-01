import { describe, expect, it } from 'vitest';

import {
  validateContextValue,
  validateIdentifier,
  validateMetadata,
  validateProjectPath,
  validateString,
} from '~/validation/security';

describe('Security Validation Functions', () => {
  describe('validateString', () => {
    it('should accept valid strings', () => {
      const validStrings = [
        'simple string',
        'string with numbers 123',
        'string-with-dashes',
        'string_with_underscores',
      ];

      validStrings.forEach(string_ => {
        expect(() => validateString(string_, 'test')).not.toThrow();
      });
    });

    it('should reject strings with script tags', () => {
      const invalidStrings = [
        '<script>alert("test")</script>',
        'text<script>malicious</script>text',
        // eslint-disable-next-line no-script-url
        'JAVASCRIPT:alert(1)',
      ];

      invalidStrings.forEach(string_ => {
        expect(() => validateString(string_, 'test')).toThrow(
          'contains potentially malicious content',
        );
      });
    });

    it('should handle empty strings when not required', () => {
      expect(() => validateString('', 'test', { required: false })).not.toThrow();
    });

    it('should validate string length', () => {
      const longString = 'x'.repeat(2000);

      expect(() => validateString(longString, 'test', { maxLength: 1000 })).toThrow(
        'must not exceed 1000 characters',
      );
    });

    it('should handle unicode strings', () => {
      const unicodeStrings = ['string with émojis 😀', '中文字符', 'русский текст', 'النص العربي'];

      unicodeStrings.forEach(string_ => {
        expect(() => validateString(string_, 'test')).not.toThrow();
      });
    });
  });

  describe('validateIdentifier', () => {
    it('should accept valid identifiers', () => {
      const validIds = ['simple-agent', 'agent_123', 'frontend-ui', 'backend-api'];

      validIds.forEach(id => {
        expect(() => validateIdentifier(id, 'agent id')).not.toThrow();
      });
    });

    it('should reject identifiers with invalid characters', () => {
      const invalidIds = [
        'agent<script>',
        'agent@domain.com', // @ is not allowed in identifier pattern
        'agent with spaces',
        'agent.with.dots', // dots not allowed
      ];

      invalidIds.forEach(id => {
        expect(() => validateIdentifier(id, 'agent id')).toThrow('contains invalid characters');
      });
    });

    it('should reject very long identifiers', () => {
      const longId = `agent-${'x'.repeat(200)}`;

      expect(() => validateIdentifier(longId, 'agent id')).toThrow(
        'must not exceed 100 characters',
      );
    });
  });

  describe('validateProjectPath', () => {
    it('should accept valid project paths', async () => {
      const validPaths = [
        '/Users/test/project',
        '/home/user/project',
        './relative/path',
        `${process.cwd()}/test`,
      ];

      for (const path of validPaths) {
        await expect(validateProjectPath(path)).resolves.not.toThrow();
      }
    });

    it('should reject paths with directory traversal', async () => {
      const invalidPaths = ['../parent/directory', '/some/path/../etc/passwd', '~/home/path'];

      for (const path of invalidPaths) {
        await expect(() => validateProjectPath(path)).rejects.toThrow('directory traversal');
      }
    });

    it('should allow paths in allowed directories', async () => {
      const allowedPath = '/Users/testuser/project';

      await expect(validateProjectPath(allowedPath)).resolves.not.toThrow();
    });
  });

  describe('validateMetadata', () => {
    it('should accept valid metadata', () => {
      const validMetadata = {
        key1: 'value1',
        key2: 123,
        key3: true,
        key4: { nested: 'object' },
      };

      expect(() => validateMetadata(validMetadata)).not.toThrow();
    });

    it('should handle undefined metadata', () => {
      expect(validateMetadata(undefined)).toBeUndefined();
      expect(validateMetadata(null)).toBeUndefined();
    });

    it('should reject non-object metadata', () => {
      expect(() => validateMetadata('string')).toThrow('Metadata must be an object');
      expect(() => validateMetadata(['array'])).toThrow('Metadata must be an object');
    });

    it('should reject metadata with too many properties', () => {
      const tooManyProps: Record<string, string> = {};

      for (let index = 0; index < 25; index++) {
        tooManyProps[`key${index}`] = `value${index}`;
      }

      expect(() => validateMetadata(tooManyProps)).toThrow('cannot have more than 20 properties');
    });

    it('should filter out dangerous keys', () => {
      const dangerousMetadata = {
        __proto__: { evil: true },
        constructor: { evil: true },
        prototype: { evil: true },
        safeKey: 'safe value',
      };

      const result = validateMetadata(dangerousMetadata);

      expect(result).toEqual({ safeKey: 'safe value' });
    });

    it('should reject invalid metadata keys', () => {
      const invalidKeys = {
        'key with spaces': 'value',
        'key@symbol': 'value',
        'key.dot': 'value',
      };

      expect(() => validateMetadata(invalidKeys)).toThrow('Invalid metadata key');
    });
  });

  describe('validateContextValue', () => {
    it('should accept valid context values', () => {
      const validValues = [
        { key: 'value' },
        ['array', 'of', 'values'],
        'string',
        123,
        true,
        false,
        null,
        { nested: { object: { with: ['array'] } } },
      ];

      validValues.forEach(value => {
        expect(() => validateContextValue(value)).not.toThrow();
      });
    });

    it('should not throw for prototype pollution attempts in regular objects', () => {
      const maliciousValue = { __proto__: { evil: true } };

      // Objects with __proto__ as regular property should not throw (they get sanitized by JSON)
      expect(() => validateContextValue(maliciousValue)).not.toThrow();
    });

    it('should handle deeply nested objects', () => {
      const deepObject: any = { level: 0 };
      let current = deepObject;

      for (let index = 1; index < 100; index++) {
        current.next = { level: index };
        current = current.next;
      }

      expect(() => validateContextValue(deepObject)).not.toThrow();
    });

    it('should handle arrays with mixed types', () => {
      const mixedArray = ['string', 123, true, null, { object: 'value' }, ['nested', 'array']];

      expect(() => validateContextValue(mixedArray)).not.toThrow();
    });

    it('should handle arrays with nested objects', () => {
      const safeArray = ['safe', { normalKey: 'value' }, 'also safe'];

      expect(() => validateContextValue(safeArray)).not.toThrow();
    });

    it('should handle circular references gracefully', () => {
      const circular: any = { a: 1 };

      circular.self = circular;

      // Should throw because JSON.stringify can't handle circular references
      expect(() => validateContextValue(circular)).toThrow('Converting circular structure');
    });

    it('should handle undefined values in objects', () => {
      const objectWithUndefined = {
        defined: 'value',
        undefined,
        nested: {
          also: undefined,
        },
      };

      expect(() => validateContextValue(objectWithUndefined)).not.toThrow();
    });

    it('should handle special object keys', () => {
      const specialKeys = {
        'key with spaces': 'value',
        'key-with-dashes': 'value',
        key_with_underscores: 'value',
        'key.with.dots': 'value',
        '123numeric': 'value',
        '': 'empty key',
      };

      expect(() => validateContextValue(specialKeys)).not.toThrow();
    });
  });

  // Note: validateNamespace is not a separate export, it's part of validateString
  // So we test namespace validation through validateString
  describe('namespace validation', () => {
    it('should accept valid namespace strings', () => {
      const validNamespaces = [
        'simple-namespace',
        'namespace_123',
        'feature.auth',
        'api/v1',
        'namespace:category',
        'UPPERCASE-NS',
        'namespace-2024',
      ];

      validNamespaces.forEach(ns => {
        expect(() => validateString(ns, 'namespace', { required: false })).not.toThrow();
      });
    });

    it('should handle empty namespace', () => {
      expect(() => validateString('', 'namespace', { required: false })).not.toThrow();
    });

    it('should reject namespaces with malicious content', () => {
      // eslint-disable-next-line no-script-url
      const invalidNamespaces = ['<script>alert(1)</script>', 'javascript:alert(1)', '__proto__'];

      invalidNamespaces.forEach(ns => {
        expect(() => validateString(ns, 'namespace')).toThrow(
          'contains potentially malicious content',
        );
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should validate agent components', () => {
      expect(() => {
        validateIdentifier('test-agent-123', 'agent id');
        validateProjectPath('/home/user/project');
        validateString('Developer', 'role');
        validateMetadata({ version: '1.0.0', environment: 'development' });
      }).not.toThrow();
    });

    it('should validate message components', () => {
      const message = {
        from: 'sender-agent',
        to: 'receiver-agent',
        content: 'This is a message with content',
        metadata: {
          priority: 'high',
          tags: 'important',
        },
      };

      expect(() => {
        validateIdentifier(message.from, 'from agent');
        validateIdentifier(message.to, 'to agent');
        validateString(message.content, 'content');
        validateMetadata(message.metadata);
      }).not.toThrow();
    });

    it('should validate context components', () => {
      const context = {
        key: 'config-key',
        value: {
          setting1: 'value1',
          setting2: { nested: 'value' },
        },
        namespace: 'app-config',
      };

      expect(() => {
        validateString(context.key, 'context key');
        validateString(context.namespace, 'namespace', { required: false });
        validateContextValue(context.value);
      }).not.toThrow();
    });

    it('should handle malicious input across validation functions', () => {
      const maliciousData = {
        id: 'agent<script>alert(1)</script>',
        metadata: {
          __proto__: { isAdmin: true },
        },
        namespace: '<script>alert(1)</script>',
      };

      expect(() => validateString(maliciousData.id, 'agent id')).toThrow(
        'contains potentially malicious content',
      );

      // Objects with __proto__ as regular property should not throw (they get sanitized by JSON)
      expect(() => validateContextValue({ __proto__: { isAdmin: true } })).not.toThrow();

      expect(() => validateString(maliciousData.namespace, 'namespace')).toThrow(
        'contains potentially malicious content',
      );
    });
  });
});
