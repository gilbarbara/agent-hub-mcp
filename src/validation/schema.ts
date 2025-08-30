import Ajv, { JSONSchemaType } from 'ajv';

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
 * Gets all available tool names
 * @returns Array of tool names
 */
export function getAvailableTools(): string[] {
  return TOOLS.map(tool => tool.name);
}

/**
 * Gets the schema for a specific tool
 * @param toolName - Name of the tool
 * @returns The JSON schema for the tool's input
 */
export function getToolSchema(toolName: string): JSONSchemaType<any> | undefined {
  const tool = TOOLS.find(t => t.name === toolName);

  return tool?.inputSchema as JSONSchemaType<any>;
}

/**
 * Checks if a tool exists
 * @param toolName - Name of the tool to check
 * @returns True if the tool exists, false otherwise
 */
export function toolExists(toolName: string): boolean {
  return validators.has(toolName);
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
