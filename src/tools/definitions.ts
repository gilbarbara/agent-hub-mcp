import { Tool } from '@modelcontextprotocol/sdk/types.js';

import { MessagePriority, MessageType } from '../types';

export const TOOLS: Tool[] = [
  {
    name: 'send_message',
    description: 'Send a message to another agent or broadcast to all agents',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source agent identifier' },
        to: { type: 'string', description: 'Target agent identifier or "all" for broadcast' },
        type: {
          type: 'string',
          enum: Object.values(MessageType),
          description: 'Message type',
        },
        content: { type: 'string', description: 'Message content' },
        metadata: { type: 'object', description: 'Additional structured data' },
        priority: {
          type: 'string',
          enum: Object.values(MessagePriority),
          description: 'Message priority',
          default: MessagePriority.NORMAL,
        },
        threadId: { type: 'string', description: 'Optional conversation thread ID' },
      },
      required: ['from', 'to', 'type', 'content'],
    },
  },
  {
    name: 'get_messages',
    description: 'Retrieve messages for an agent',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent identifier to get messages for' },
        markAsRead: {
          type: 'boolean',
          description: 'Mark retrieved messages as read',
          default: true,
        },
        type: {
          type: 'string',
          enum: Object.values(MessageType),
          description: 'Filter by message type',
        },
        since: { type: 'number', description: 'Get messages since timestamp' },
      },
      required: ['agent'],
    },
  },
  {
    name: 'set_context',
    description: 'Store a value in the shared context',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Context key' },
        value: { description: 'Context value (any JSON-serializable data)' },
        agent: { type: 'string', description: 'Agent setting the context' },
        ttl: { type: 'number', description: 'Time-to-live in milliseconds' },
        namespace: { type: 'string', description: 'Optional namespace for organization' },
      },
      required: ['key', 'value', 'agent'],
    },
  },
  {
    name: 'get_context',
    description: 'Retrieve values from the shared context',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Specific context key to retrieve' },
        namespace: { type: 'string', description: 'Filter by namespace' },
      },
    },
  },
  {
    name: 'register_agent',
    description: 'Register an agent with the hub (may require approval)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Agent identifier (optional - will be generated from project path if not provided)',
        },
        projectPath: { type: 'string', description: 'Agent working directory' },
        role: { type: 'string', description: 'Agent role description' },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agent capabilities',
        },
        collaboratesWith: {
          type: 'array',
          items: { type: 'string' },
          description: 'Expected collaborators',
        },
      },
      required: ['projectPath', 'role'],
    },
  },
  {
    name: 'approve_agent',
    description: 'Approve or reject a pending agent registration',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'ID of the agent to approve/reject' },
        approve: { type: 'boolean', description: 'Whether to approve (true) or reject (false)' },
        restrictions: {
          type: 'string',
          enum: ['full', 'read-only', 'limited'],
          description: 'Access level for approved agent (default: full)',
        },
        reason: { type: 'string', description: 'Optional reason for the decision' },
      },
      required: ['agentId', 'approve'],
    },
  },
  {
    name: 'set_approval_required',
    description: 'Configure whether new agents require approval to join',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable or disable approval requirement' },
        trustedAgents: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agent IDs that do not require approval',
        },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent working on the task' },
        task: { type: 'string', description: 'Task identifier or description' },
        status: {
          type: 'string',
          enum: ['started', 'in-progress', 'completed', 'blocked'],
          description: 'Task status',
        },
        details: { type: 'string', description: 'Additional details' },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task dependencies',
        },
      },
      required: ['agent', 'task', 'status'],
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get status of agents and their tasks',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Specific agent to query' },
      },
    },
  },
  {
    name: 'start_collaboration',
    description: 'Initialize collaboration for a feature',
    inputSchema: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Feature name or identifier' },
        agent: { type: 'string', description: 'Agent starting the collaboration' },
      },
      required: ['feature'],
    },
  },
  {
    name: 'sync_request',
    description: 'Send a synchronous request to another agent and wait for response',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Requesting agent' },
        to: { type: 'string', description: 'Target agent' },
        topic: { type: 'string', description: 'Topic or question' },
        timeout: { type: 'number', description: 'Timeout in milliseconds', default: 30000 },
      },
      required: ['from', 'to', 'topic'],
    },
  },
];
