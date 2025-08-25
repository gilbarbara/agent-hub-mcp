# Agent Hub MCP - Product Requirements Document

## Executive Summary

The Agent Hub MCP enables seamless communication and coordination between multiple Claude Code agents working across different repositories in a multi-service architecture. It provides a centralized message broker and shared context store, allowing AI coding agents to collaborate on complex features that span multiple codebases.

## Problem Statement

### Current Challenges
- **Isolated Agent Sessions**: Each Claude Code instance operates in isolation when working on different repositories
- **Manual Context Transfer**: Developers must manually copy and communicate context between agent sessions
- **No Cross-Repository Coordination**: Agents cannot notify each other about completed tasks or dependencies
- **Duplicated Effort**: Agents may solve similar problems without sharing solutions
- **Lack of Feature-Wide Context**: No unified understanding of the overall feature being implemented

### Impact
- Increased cognitive load on developers to manage multiple agent conversations
- Slower development velocity for features spanning multiple services
- Higher risk of integration issues due to lack of coordination
- Inconsistent implementations across services

## Goals and Objectives

### Primary Goals
1. Enable asynchronous message passing between Claude Code agents
2. Provide shared context storage accessible by all agents
3. Support task coordination and dependency tracking
4. Maintain conversation history for audit and debugging

### Success Criteria
- Reduce cross-repository feature implementation time by 30%
- Zero message loss between agents
- Sub-second message delivery latency
- 100% uptime during development sessions

## User Stories

### As a Developer
1. **I want to** have my backend agent notify the frontend agent about API changes **so that** the frontend can update immediately
2. **I want to** share discovered patterns between agents **so that** all services follow consistent practices
3. **I want to** see the status of all agents working on a feature **so that** I know overall progress
4. **I want to** have agents automatically detect their role **so that** I don't need manual configuration

### As a Backend Agent
1. **I want to** broadcast API schema changes **so that** consuming services can update
2. **I want to** receive questions from other agents **so that** I can clarify implementation details
3. **I want to** know when frontend is ready **so that** I can proceed with integration tests

### As a Frontend Agent
1. **I want to** be notified of backend changes **so that** I can update API calls
2. **I want to** share UI component patterns **so that** other frontends maintain consistency
3. **I want to** report completion status **so that** dependent tasks can proceed

## Technical Architecture

### System Components

**HTTP Transport Architecture (Recommended)**:
```
┌─────────────────────────────────────────────────────┐
│                   Developer Machine                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │Claude Code   │  │Claude Code   │  │Claude Code│  │
│  │(Frontend)    │  │(Backend)     │  │(Hub)      │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │ HTTP/SSE         │ HTTP/SSE       │        │
│         └──────────────────┼────────────────┘        │
│                           │                          │
│         ┌─────────────────▼─────────────────┐        │
│         │     HTTP MCP Server (Port 3737)   │        │
│         │  ┌─────────────────────────────┐   │        │
│         │  │   Express.js + CORS         │   │        │
│         │  │ ┌─────────────────────────┐ │   │        │
│         │  │ │ StreamableHTTPTransport │ │   │        │
│         │  │ │   + Session Manager     │ │   │        │
│         │  │ └─────────────────────────┘ │   │        │
│         │  └─────────────────────────────┘   │        │
│         │  ┌─────────────────────────────┐   │        │
│         │  │    Instant Notifications   │   │        │
│         │  │      (SSE Streaming)        │   │        │
│         │  └─────────────────────────────┘   │        │
│         └─────────────────┬─────────────────┘        │
│                           │                          │
│                    ┌──────▼──────┐                  │
│                    │ File Storage │                  │
│                    │ (.agent-hub) │                  │
│                    └──────────────┘                  │
└──────────────────────────────────────────────────────┘
```

**Legacy stdio Architecture**:
```
┌─────────────────────────────────────────────────────┐
│                   Developer Machine                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │Claude Code   │  │Claude Code   │  │Claude Code│  │
│  │(Frontend)    │  │(Backend)     │  │(Hub)      │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │ stdio            │ stdio          │        │
│         └──────────────────┼────────────────┘        │
│                           │                          │
│                    ┌──────▼──────┐                  │
│                    │ stdio Server │                  │
│                    │ (Agent Hub)  │                  │
│                    └──────┬───────┘                  │
│                           │                          │
│                    ┌──────▼──────┐                  │
│                    │ File Storage │                  │
│                    │ (.agent-hub) │                  │
│                    └──────────────┘                  │
└──────────────────────────────────────────────────────┘
```

### Data Models

#### Message
```typescript
interface Message {
  id: string;                    // Unique message identifier
  from: string;                  // Source agent identifier
  to: string | 'all';           // Target agent or broadcast
  type: MessageType;            // Message classification
  content: string;              // Message body
  metadata?: Record<string, any>; // Additional structured data
  timestamp: number;            // Creation timestamp
  read: boolean;                // Read status
  threadId?: string;            // Optional conversation thread
}

enum MessageType {
  CONTEXT = 'context',          // Sharing information
  TASK = 'task',               // Task assignment/update
  QUESTION = 'question',       // Requesting information
  COMPLETION = 'completion',   // Task completion notice
  ERROR = 'error',            // Error notification
  SYNC_REQUEST = 'sync_request' // Request for synchronization
}
```

#### SharedContext
```typescript
interface SharedContext {
  key: string;                  // Context identifier
  value: any;                  // Context data
  version: number;             // Version for conflict resolution
  updatedBy: string;           // Last modifier
  timestamp: number;           // Last update time
  ttl?: number;               // Optional time-to-live
}
```

#### AgentRegistration
```typescript
interface AgentRegistration {
  id: string;                  // Agent identifier
  projectPath: string;         // Working directory
  role: string;               // Agent role description
  capabilities: string[];      // What this agent can do
  status: 'active' | 'idle' | 'offline';
  lastSeen: number;           // Last activity timestamp
  collaboratesWith: string[]; // Expected collaborators
}
```

## Feature Requirements

### Core Features

#### 1. Message Exchange
- **Send Message**: Direct or broadcast messages between agents
- **Get Messages**: Retrieve unread messages with optional filters
- **Mark as Read**: Update message read status
- **Message Threading**: Optional conversation threads
- **Priority Levels**: Urgent, normal, low priority messages

#### 2. Shared Context Store
- **Set Context**: Store key-value pairs accessible by all agents
- **Get Context**: Retrieve specific or all context values
- **Update Context**: Atomic updates with version control
- **Context Namespacing**: Organize context by feature/domain
- **TTL Support**: Auto-expire temporary context

#### 3. Agent Coordination
- **Agent Registration**: Auto-detect and register agents
- **Status Broadcasting**: Share agent status and progress
- **Task Management**: Create, assign, and track tasks
- **Dependency Tracking**: Define and monitor task dependencies
- **Agent Discovery**: List active agents and their capabilities

#### 4. Persistence & Recovery
- **Message Persistence**: Store messages to disk
- **Context Persistence**: Maintain context across sessions
- **Recovery**: Restore state after restart
- **History**: Query historical messages and context changes
- **Cleanup**: Automatic cleanup of old data

#### 5. Fast Communication (HTTP Transport)
- **Server-Sent Events (SSE)**: Live notification streaming to connected agents
- **Session Management**: Persistent connections with automatic cleanup
- **Auto-registration**: Agents register automatically on session initialization
- **Project Detection**: Intelligent capability and role detection from project structure
- **Instant Notifications**: Fast delivery of messages, context updates, and agent events
- **Health Monitoring**: Health check endpoints and connection status tracking
- **CORS Support**: Browser-compatible with proper CORS headers
- **Security**: DNS rebinding protection and configurable host restrictions

#### 6. Transport Flexibility
- **Dual Transport Support**: Both HTTP and stdio transports available
- **Backward Compatibility**: Legacy stdio transport maintained for existing setups
- **Configuration Options**: Header-based agent customization for HTTP transport
- **Development vs Production**: Different configurations for dev and production environments

### MCP Tools API

```typescript
interface MCPTools {
  // Messaging
  send_message(params: {
    from: string;
    to: string;
    type: string;
    content: string;
    metadata?: object;
    priority?: 'urgent' | 'normal' | 'low';
  }): Promise<{success: boolean; messageId: string}>;

  get_messages(params: {
    agent: string;
    markAsRead?: boolean;
    type?: string;
    since?: number;
  }): Promise<{count: number; messages: Message[]}>;

  // Context
  set_context(params: {
    key: string;
    value: any;
    agent: string;
    ttl?: number;
  }): Promise<{success: boolean; version: number}>;

  get_context(params: {
    key?: string;
    namespace?: string;
  }): Promise<Record<string, any>>;

  // Coordination
  register_agent(params: {
    detectFromProject?: boolean;
    id?: string;
    role?: string;
    capabilities?: string[];
  }): Promise<AgentRegistration>;

  update_task_status(params: {
    agent: string;
    task: string;
    status: 'started' | 'in-progress' | 'completed' | 'blocked';
    details?: string;
    dependencies?: string[];
  }): Promise<{success: boolean}>;

  get_agent_status(params: {
    agent?: string;
  }): Promise<{
    agents: AgentRegistration[];
    tasks: TaskStatus[];
  }>;

  // Utilities
  start_collaboration(params: {
    feature: string;
    agent?: string;
  }): Promise<{
    agent: string;
    pendingMessages: number;
    activeAgents: string[];
  }>;

  sync_request(params: {
    from: string;
    to: string;
    topic: string;
    timeout?: number;
  }): Promise<{
    response?: string;
    timeout?: boolean;
  }>;
}
```

## Implementation Phases

### Phase 1: MVP ✅ **COMPLETED**
- [x] Basic message send/receive
- [x] Simple key-value context store
- [x] File-based persistence
- [x] Manual agent identification
- [x] Basic MCP stdio server setup
- [x] Core MCP tools implementation

### Phase 2: HTTP Transport ✅ **COMPLETED**
- [x] HTTP MCP server with Express.js
- [x] Streamable HTTP transport with SSE support
- [x] Session management and persistent connections
- [x] Auto-registration on session initialization
- [x] Instant notification framework
- [x] Enhanced project-based agent detection
- [x] Dual transport support (stdio + HTTP)

### Phase 3: Advanced Features ✅ **COMPLETED**
- [x] Task management system
- [x] Priority messaging (urgent, normal, low)
- [x] Synchronous request/response (sync_request tool)
- [x] Context namespacing and TTL support
- [x] Agent status and presence tracking
- [x] Message threading support
- [x] Comprehensive test suite

### Phase 4: Production Ready ✅ **COMPLETED**
- [x] Complete documentation (CLAUDE.md, HTTP-CONFIG.md)
- [x] Configuration examples for both transports
- [x] Health check endpoints
- [x] CORS support for browser clients
- [x] DNS rebinding protection
- [x] Build scripts for both server types
- [x] TypeScript type safety throughout

### Phase 5: Future Enhancements 🚧 **PLANNED**
- [ ] Web dashboard for monitoring active agents
- [ ] CLI for manual interaction and debugging
- [ ] Enhanced SSE streaming implementation
- [ ] Collaboration rooms and feature-specific channels
- [ ] Agent capability matching and suggestions
- [ ] Performance metrics and analytics
- [ ] Docker deployment and scaling
- [ ] Authentication and authorization
- [ ] Message history viewer
- [ ] Debug mode with verbose logging
- [ ] Performance optimizations

## Configuration

### Agent Configuration (`.agent-hub.json`)
```json
{
  "agent": "backend",
  "role": "API and business logic implementation",
  "capabilities": [
    "api-design",
    "database-schema",
    "business-logic"
  ],
  "collaborates_with": ["frontend", "hub"],
  "auto_register": true,
  "check_messages_on_start": true,
  "message_poll_interval": 5000
}
```

### MCP Server Configuration
```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "node",
      "args": ["path/to/agent-hub-mcp/dist/index.js"],
      "env": {
        "AGENT_HUB_PORT": "7650",
        "AGENT_HUB_DATA_DIR": ".agent-hub",
        "AGENT_HUB_LOG_LEVEL": "info"
      }
    }
  }
}
```

## Usage Examples

### Feature Development Workflow

```typescript
// Backend agent starts work
await start_collaboration({ 
  feature: "user-authentication",
  agent: "backend" 
});

// Backend implements API and notifies frontend
await send_message({
  from: "backend",
  to: "frontend",
  type: "context",
  content: "Auth endpoints ready: POST /auth/login, POST /auth/logout",
  metadata: {
    endpoints: ["/auth/login", "/auth/logout"],
    schema: { /* OpenAPI spec */ }
  }
});

// Frontend receives and acknowledges
const messages = await get_messages({ agent: "frontend" });
// Process API changes...

// Frontend has a question
await send_message({
  from: "frontend",
  to: "backend",
  type: "question",
  content: "Should the auth token be stored in localStorage or sessionStorage?"
});

// Backend responds
await send_message({
  from: "backend",
  to: "frontend",
  type: "context",
  content: "Use sessionStorage for security. Token expires in 24h."
});

// Frontend completes implementation
await update_task_status({
  agent: "frontend",
  task: "auth-ui-implementation",
  status: "completed",
  details: "Login/logout UI complete with sessionStorage"
});
```

## Success Metrics

### Quantitative Metrics
- **Message Delivery Rate**: >99.9%
- **Message Latency**: <100ms average
- **System Uptime**: 100% during dev sessions
- **Storage Efficiency**: <10MB for 10,000 messages
- **Agent Registration Time**: <1 second

### Qualitative Metrics
- **Developer Satisfaction**: Reduced context switching
- **Feature Velocity**: Faster multi-service features
- **Error Reduction**: Fewer integration issues
- **Knowledge Sharing**: Increased pattern reuse

## Security Considerations

### Data Protection
- Messages stored locally only
- No external network communication
- File permissions restrict access to user

### Privacy
- No telemetry or analytics
- No cloud synchronization
- All data remains on developer machine

### Access Control
- Agents identified by project directory
- No authentication between local agents
- Trust model based on local execution

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Message loss during crash | High | Immediate persistence, transaction log |
| Circular dependencies | Medium | Dependency cycle detection |
| Storage growth | Low | Automatic cleanup, rotation |
| Agent identification collision | Medium | Unique ID generation, conflict resolution |
| Performance degradation | Medium | Indexing, pagination, cleanup |

## Future Enhancements

### Version 2.0
- Cloud synchronization option
- Multi-developer collaboration
- Git integration for context branching
- AI-powered message routing
- Conflict resolution strategies

### Version 3.0
- Visual workflow designer
- Automated testing coordination
- Performance profiling
- Plugin system for extensions
- Integration with CI/CD pipelines

## Appendix

### A. Message Format Examples
```json
{
  "id": "msg-1234567890-abc123",
  "from": "backend",
  "to": "frontend",
  "type": "context",
  "content": "Database schema updated for user profiles",
  "metadata": {
    "tables": ["users", "profiles"],
    "migration": "20240115_add_user_profiles.sql"
  },
  "timestamp": 1705334400000,
  "read": false
}
```

### B. Context Storage Example
```json
{
  "feature:authentication": {
    "value": {
      "type": "JWT",
      "expiry": "24h",
      "refresh": true
    },
    "updatedBy": "backend",
    "version": 3,
    "timestamp": 1705334400000
  }
}
```

### C. Error Codes
- `ERR_AGENT_NOT_FOUND`: Target agent not registered
- `ERR_MESSAGE_TIMEOUT`: Synchronous request timeout
- `ERR_CONTEXT_CONFLICT`: Version conflict in context update
- `ERR_STORAGE_FULL`: Storage limit exceeded
- `ERR_INVALID_CONFIG`: Invalid agent configuration

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Engineering Manager | | | |
