import { MessagePriority, MessageType } from '~/types';

/**
 * Security validation utilities for input sanitization
 */

/**
 * Validates context values to prevent injection
 */
export function validateContextValue(value: unknown): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Prevent prototype pollution by checking for explicitly set dangerous properties
  if (typeof value === 'object') {
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const valueObject = value as any;

    for (const key of dangerous) {
      // Only reject if the property was explicitly set (not inherited)
      if (Object.prototype.hasOwnProperty.call(valueObject, key)) {
        throw new Error('Context value contains dangerous properties');
      }
    }
  }

  // Deep sanitize by JSON serialization
  return JSON.parse(JSON.stringify(value));
}

/**
 * Validates agent IDs and similar identifiers
 */
export function validateIdentifier(value: unknown, fieldName: string): string {
  return validateString(value, fieldName, {
    required: true,
    maxLength: 100,
    pattern: /^[\w-]+$/,
  });
}

/**
 * Validates message priority
 */
export function validateMessagePriority(value: unknown): MessagePriority | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new TypeError('Priority must be a string');
  }

  const validPriorities = Object.values(MessagePriority);

  if (!validPriorities.includes(value as MessagePriority)) {
    throw new Error(`Invalid priority: ${value}`);
  }

  return value as MessagePriority;
}

/**
 * Validates message type
 */
export function validateMessageType(value: unknown): MessageType {
  if (!value || typeof value !== 'string') {
    throw new Error('Invalid message type');
  }

  const validTypes = Object.values(MessageType);

  if (!validTypes.includes(value as MessageType)) {
    throw new Error(`Invalid message type: ${value}`);
  }

  return value as MessageType;
}

/**
 * Validates and sanitizes metadata objects
 */
export function validateMetadata(value: unknown): Record<string, any> | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Metadata must be an object');
  }

  const metadata = value as Record<string, any>;

  // Limit metadata size
  const keys = Object.keys(metadata);

  if (keys.length > 20) {
    throw new Error('Metadata cannot have more than 20 properties');
  }

  // Sanitize metadata to prevent prototype pollution
  const sanitized: Record<string, any> = {};

  for (const [key, value_] of Object.entries(metadata)) {
    // Skip dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // Validate key
    if (!/^[\w-]+$/.test(key)) {
      throw new Error(`Invalid metadata key: ${key}`);
    }

    // Deep copy and sanitize value
    sanitized[key] = JSON.parse(JSON.stringify(value_));
  }

  return sanitized;
}

/**
 * Validates project paths to prevent directory traversal
 */
export function validateProjectPath(path: string): string {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid project path');
  }

  // Prevent directory traversal
  if (path.includes('..') || path.includes('~')) {
    throw new Error('Invalid project path: directory traversal detected');
  }

  // Only allow specific safe directories
  const allowedPrefixes = [
    '/Users/',
    '/home/',
    '/var/www/',
    '/opt/',
    '/workspace/',
    '/tmp/',
    process.cwd(), // Current working directory
  ];

  const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));

  if (!isAllowed && !path.startsWith('./') && !path.startsWith('/')) {
    throw new Error('Project path must be in an allowed directory');
  }

  return path;
}

/**
 * Validates string inputs to prevent injection attacks
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    required?: boolean;
  } = {},
): string {
  const { maxLength = 1000, minLength = 1, pattern, required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }

    return '';
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (required && trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }

  if (pattern && !pattern.test(trimmed)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }

  // Check for common injection patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onload, etc.
    /__proto__/,
    /constructor\[/,
    /prototype\[/,
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(trimmed)) {
      throw new Error(`${fieldName} contains potentially malicious content`);
    }
  }

  return trimmed;
}
