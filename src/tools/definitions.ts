import { Tool } from '@modelcontextprotocol/sdk/types.js';

import { FeaturePriority, FeatureStatus } from '~/features/types';

import { MessagePriority, MessageType } from '~/types';

export const TOOLS: Tool[] = [
  {
    name: 'register_agent',
    description: 'Register an agent with the hub',
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
          default: [],
        },
        collaboratesWith: {
          type: 'array',
          items: { type: 'string' },
          description: 'Expected collaborators',
          default: [],
        },
      },
      required: ['projectPath', 'role'],
    },
  },
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
    name: 'get_hub_status',
    description: 'Get overview of hub activity, agents, and collaboration opportunities',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_feature',
    description: 'Create a new feature for multi-agent collaboration',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Feature name (will be converted to kebab-case ID)' },
        title: { type: 'string', description: 'Human-readable feature title' },
        description: { type: 'string', description: 'Detailed feature requirements and context' },
        priority: {
          type: 'string',
          enum: Object.values(FeaturePriority),
          description: 'Feature priority level',
          default: FeaturePriority.NORMAL,
        },
        estimatedAgents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agents expected to be needed for this feature',
          default: [],
        },
        createdBy: { type: 'string', description: 'Agent creating this feature' },
      },
      required: ['name', 'title', 'description', 'createdBy'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task within a feature with agent delegations',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string', description: 'Feature ID to create task in' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Detailed task requirements' },
        delegations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agent: { type: 'string', description: 'Agent ID to delegate to' },
              scope: { type: 'string', description: 'What this agent should accomplish' },
            },
            required: ['agent', 'scope'],
          },
          description: 'Agent delegations for this task',
        },
        createdBy: { type: 'string', description: 'Agent creating this task' },
      },
      required: ['featureId', 'title', 'description', 'delegations', 'createdBy'],
    },
  },
  {
    name: 'create_subtask',
    description: 'Create implementation subtasks within a delegation',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string', description: 'Feature ID' },
        delegationId: { type: 'string', description: 'Delegation ID to create subtasks for' },
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Subtask title' },
              description: { type: 'string', description: 'Subtask description' },
              dependsOn: {
                type: 'array',
                items: { type: 'string' },
                description: 'Subtask IDs this depends on',
                default: [],
              },
            },
            required: ['title'],
          },
          description: 'Subtasks to create',
        },
        createdBy: { type: 'string', description: 'Agent creating these subtasks' },
      },
      required: ['featureId', 'delegationId', 'subtasks', 'createdBy'],
    },
  },
  {
    name: 'get_agent_workload',
    description: 'Get all work assigned to an agent across all features',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID to get workload for' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'get_features',
    description: 'Get list of features with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(FeatureStatus),
          description: 'Filter by feature status',
        },
        priority: {
          type: 'string',
          enum: Object.values(FeaturePriority),
          description: 'Filter by feature priority',
        },
        agent: { type: 'string', description: 'Filter features assigned to this agent' },
        createdBy: { type: 'string', description: 'Filter features created by this agent' },
      },
    },
  },
  {
    name: 'get_feature',
    description: 'Get complete feature data including tasks, delegations, and subtasks',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string', description: 'Feature ID to retrieve' },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'accept_delegation',
    description: 'Accept a delegation assigned to an agent',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string', description: 'Feature ID' },
        delegationId: { type: 'string', description: 'Delegation ID to accept' },
        agentId: { type: 'string', description: 'Agent accepting the delegation' },
      },
      required: ['featureId', 'delegationId', 'agentId'],
    },
  },
  {
    name: 'update_subtask',
    description: 'Update subtask status and provide output/context',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string', description: 'Feature ID' },
        subtaskId: { type: 'string', description: 'Subtask ID to update' },
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'completed', 'blocked'],
          description: 'New subtask status',
        },
        output: { type: 'string', description: 'Output or context for other agents' },
        blockedReason: { type: 'string', description: 'Reason if status is blocked' },
        updatedBy: { type: 'string', description: 'Agent updating this subtask' },
      },
      required: ['featureId', 'subtaskId', 'updatedBy'],
    },
  },
];
