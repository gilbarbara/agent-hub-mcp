import Ajv from 'ajv';

import { TOOLS } from '~/tools/definitions';

// Create AJV instance with validation options
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: false,
});

// Create a map of tool name to compiled validator
const validators = new Map<string, any>();

// Initialize validators from tool definitions
for (const tool of TOOLS) {
  const validator = ajv.compile(tool.inputSchema);

  validators.set(tool.name, validator);
}

/**
 * Validates tool input arguments against the tool's schema
 * @param toolName - Name of the tool
 * @param arguments_ - Arguments to validate
 * @throws Error if validation fails
 * @returns The validated arguments (potentially with defaults applied)
 */
export function validateToolInput(toolName: string, arguments_: any): any {
  const validator = validators.get(toolName);

  if (!validator) {
    throw new Error(`No validator found for tool: ${toolName}`);
  }

  const valid = validator(arguments_);

  if (!valid) {
    const errors = validator.errors ?? [];
    const errorMessages = errors.map((error: any) => {
      const instancePath = error.instancePath ?? 'root';

      return `${instancePath}: ${error.message}`;
    });

    throw new Error(`Validation failed for tool '${toolName}': ${errorMessages.join(', ')}`);
  }

  return arguments_;
}
