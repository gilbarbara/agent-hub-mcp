# Agent Hub MCP - System Overview

This document provides a comprehensive overview of the Agent Hub MCP architecture, components, and their interactions.

## System Architecture

The Agent Hub MCP is a multi-agent coordination system that enables communication, context sharing, and task coordination between multiple Claude Code agents working across different projects.

```mermaid
graph TB
    subgraph "Agent Hub MCP Core"
        MCP[MCP Server]
        HTTP[HTTP Server]
        STDIO[stdio Transport]
        
        MCP -.->|"optional"| HTTP
        MCP --> STDIO
    end
    
    subgraph "Core Services"
        MSG[Message Service]
        FEAT[Features Service]
        AGENT[Agent Management]
    end
    
    subgraph "Storage Layer"
        STOR[Storage Interface]
        FILE[File Storage]
        IDX[Indexed Storage]
        
        STOR --> FILE
        STOR --> IDX
    end
    
    subgraph "Client Agents"
        A1[Agent 1<br/>Frontend Project]
        A2[Agent 2<br/>Backend Project]
        A3[Agent N<br/>Other Project]
    end
    
    MCP --> MSG
    MCP --> FEAT
    MCP --> AGENT
    
    MSG --> STOR
    FEAT --> STOR
    AGENT --> STOR
    
    A1 <--> MCP
    A2 <--> MCP
    A3 <--> MCP
```

## Core Components

### 1. MCP Server (src/servers/mcp.ts)

The Model Context Protocol server that handles tool calls and resource management.

**Key Responsibilities:**
- Process MCP tool requests
- Manage agent sessions
- Handle resource subscriptions
- Coordinate with core services

**Features:**

- Auto-agent registration detection
- Session management
- Resource change notifications
- Tool validation and error handling

### 2. Message Service (src/messaging/service.ts)

Handles inter-agent communication, supporting various message types and priorities.

```mermaid
graph LR
    subgraph "Message Types"
        CONTEXT["**Context**<br/>Information sharing"]
        TASK["**Task**<br/>Work coordination"]
        QUESTION["**Question**<br/>Information requests"]
        COMPLETION["**Completion**<br/>Task notifications"]
        ERROR["**Error**<br/>Error reporting"]
        SYNC["**Sync Request**<br/>Real-time requests"]
    end
    
    subgraph "Message Priorities"
        URGENT["**Urgent**<br/>Immediate attention"]
        NORMAL["**Normal**<br/>Standard priority"]
        LOW["**Low**<br/>Background info"]
    end
    
    subgraph "Message Features"
        THREAD["**Threading**<br/>Conversation grouping"]
        META["**Metadata**<br/>Structured data"]
        BROADCAST["**Broadcast**<br/>Send to all agents"]
        READ["**Read Status**<br/>Track message state"]
    end
```

**Key Methods:**

- `sendMessage()` - Send messages between agents
- `getMessages()` - Retrieve messages with filtering

### 3. Features Service (src/features/service.ts)

Coordinates multi-agent collaboration through feature-based project organization.

```mermaid
graph TB
    subgraph "Feature Hierarchy"
        FEAT["**Feature**<br/>Multi-agent project"]
        TASK_F["**Task**<br/>Major work item"]
        DEL["**Delegation**<br/>Agent assignment"]
        SUB["**Subtask**<br/>Implementation work"]
    end
    
    FEAT --> TASK_F
    TASK_F --> DEL
    DEL --> SUB
    
    subgraph "Status Flow"
        PLAN["planning"] --> ACTIVE["active"]
        ACTIVE --> COMP["completed"]
        ACTIVE --> HOLD["on-hold"]
        ACTIVE --> CANC["cancelled"]
    end
    
    subgraph "Priority Levels"
        CRIT["critical"] 
        HIGH["high"]
        NORM["normal"]
        LOW["low"]
    end
```

**Key Features:**
- **Multi-Feature Support**: Agents work across multiple active features
- **Priority Management**: Critical features take precedence
- **Context Isolation**: Each feature maintains its own scope
- **Load Distribution**: Work distributes naturally across available agents
- **Dependency Tracking**: Agents can see what others are working on within features

**Core Methods:**
- `createFeature()` - Start new multi-agent project
- `createTask()` - Break features into delegated work
- `getAgentWorkload()` - Get all agent assignments across features
- `updateSubtask()` - Track implementation progress

### 5. Agent Management (src/agents/)

Handles agent detection, service, and lifecycle management.

```mermaid
graph TB
    subgraph "Agent Lifecycle"
        REG["Registration<br/>Project detection"]
        DETECT["Detection<br/>Auto-discovery"]
        SESSION["Session<br/>Active management"]
        CLEANUP["Cleanup<br/>Inactive agents"]
    end
    
    subgraph "Agent Features"
        CAP["Capabilities<br/>Technology detection"]
        COLLAB["Collaboration<br/>Team preferences"]
        PROJ["Project Path<br/>Working directory"]
        ROLE["Role<br/>Responsibility area"]
    end
    
    REG --> CAP
    REG --> COLLAB
    REG --> PROJ
    REG --> ROLE
    
    DETECT --> REG
    SESSION --> REG
    CLEANUP --> SESSION
```

**Key Components:**
- **Detection** (`detection.ts`) - Auto-detect project capabilities  
- **Session** (`session.ts`) - Active agent session management
- **Cleanup** (`cleanup.ts`) - Remove inactive agents

## Storage Layer

The system supports two storage implementations:

### File Storage (src/storage/file-storage.ts)
- **Direct file system operations** - No caching layer for multi-instance reliability
- **Simple JSON serialization** - Human-readable storage format
- **Directory-based organization** - Logical separation of data types
- **Atomic write operations** - Prevents data corruption during writes
- **Cross-platform paths** - Works on Windows, macOS, Linux
- **File permissions** - Secure storage directory access (755)

```mermaid
graph TB
    subgraph "Storage Structure"
        ROOT[".agent-hub/"]
        MSGS["messages/<br/>Agent message queues"]
        AGENTS["agents/<br/>Registration data"]
        FEATURES["features/<br/>Feature-based collaboration"]
    end
    
    ROOT --> MSGS
    ROOT --> AGENTS  
    ROOT --> FEATURES
    
    subgraph "Data Organization"
        MSGS --> MSG_FILES["agent-id.json<br/>Message arrays"]
        AGENTS --> AGENT_FILES["agent-id.json<br/>Registration data"]
        FEATURES --> FEAT_STRUCT["features.json<br/>tasks.json<br/>delegations.json<br/>subtasks.json"]
    end
```

## Transport Options

### 1. stdio Transport (Primary)
- Process-based communication
- Direct MCP integration
- Manual agent registration required
- Best for local development and production
- Multi-instance.

### 2. HTTP Transport (Development/Debug)
- RESTful API with Server-Sent Events
- Browser-compatible debugging
- Auto-discovery and session management 
- Web dashboard capabilities

```mermaid
sequenceDiagram
    participant C as Claude Code
    participant M as MCP Server
    participant S as Storage
    participant A as Other Agent
    
    C->>M: Tool Call (send_message)
    M->>S: Save Message
    M->>A: Notification (optional)
    S-->>M: Success
    M-->>C: Response
    
    Note over C,A: Asynchronous Communication
    
    A->>M: Tool Call (get_messages)
    M->>S: Query Messages
    S-->>M: Return Messages
    M->>S: Mark as Read
    M-->>A: Messages + Metadata
```

## Communication Patterns

### 1. Asynchronous Messaging
- Agents send messages to queues
- Recipients poll for new messages
- Supports threading and metadata
- Persistent delivery guaranteed

### 2. Feature-Based Coordination
- Multi-agent projects with clear scope
- Task delegation with specific assignments
- Progress tracking through subtasks
- Context sharing within feature boundaries

### 3. Task Coordination
- Dependency tracking
- Status updates
- Progress monitoring
- Collaboration initialization

## Data Flow

```mermaid
flowchart TD
    START([Agent Starts]) --> DETECT{Auto-detect<br/>Project?}
    DETECT -->|Yes| AUTO[Auto-register<br/>with detection]
    DETECT -->|No| MANUAL[Manual registration<br/>required]
    
    AUTO --> WELCOME[Send welcome<br/>message]
    MANUAL --> REMIND[Send registration<br/>reminder]
    
    WELCOME --> ACTIVE[Active Agent]
    REMIND --> WAIT[Wait for<br/>registration]
    WAIT --> REGISTER[Register Agent] --> WELCOME
    
    ACTIVE --> WORK[Normal Operations]
    
    WORK --> MSG[Send/Receive<br/>Messages]
    WORK --> FEAT[Work on Features<br/>& Delegations]
    
    MSG --> NOTIFY[Notify Other<br/>Agents]
    FEAT --> COORD[Coordinate Multi-Agent<br/>Features]
    
    NOTIFY --> WORK
    COORD --> WORK
    
    WORK --> IDLE{Inactive?}
    IDLE -->|No| WORK
    IDLE -->|Yes| CLEANUP[Mark Offline<br/>& Cleanup]
    CLEANUP --> END([Session End])
```

## Security & Validation

The system includes security measures:

- **Input Validation** (`src/validation/`) - Schema validation for all inputs
- **Path Security** - Prevents directory traversal attacks
- **CORS Restrictions** - HTTP server limited to localhost
- **Rate Limiting** - Prevents abuse of HTTP endpoints
- **File Permissions** - Secure storage directory access

## Performance Considerations

### Indexed Storage Benefits:
- **In-Memory Caching** - Fast repeated queries
- **Index Optimization** - Efficient filtering  
- **Batch Operations** - Reduced I/O overhead
- **Cache Statistics** - Performance monitoring

### Scalability Limits:
- **File-based Storage** - Not suitable for high concurrency
- **Memory Usage** - Context data kept in memory
- **Concurrent Access** - File locking may cause delays

## Integration Points

### MCP Client Integration:
```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "node",
      "args": ["/path/to/agent-hub-mcp/dist/index.js"],
      "env": {
        "AGENT_HUB_DATA_DIR": "/path/to/.agent-hub"
      }
    }
  }
}
```

### Available MCP Tools:
- `register_agent` - Agent registration and reconnection
- `send_message` - Inter-agent communication
- `get_messages` - Message retrieval
- `get_hub_status` - Hub activity monitoring
- `create_feature` - Start multi-agent projects
- `create_task` - Break features into delegated work
- `create_subtask` - Track implementation steps
- `accept_delegation` - Accept assigned work
- `update_subtask` - Report progress
- `get_agent_workload` - View assigned work
- `get_features` - List features with filtering
- `get_feature` - Get complete feature data

## Monitoring & Debugging

### File System Monitoring:
```bash
# Monitor storage directory
ls -la ~/.agent-hub/
ls -la ~/.agent-hub/messages/    # Agent message queues
ls -la ~/.agent-hub/agents/      # Agent registrations  
ls -la ~/.agent-hub/features/    # Feature collaboration data

# Storage directory structure:
# .agent-hub/
# ├── messages/           # Individual agent message files
# │   ├── agent-1.json   
# │   └── agent-2.json
# ├── agents/            # Agent registration files
# │   ├── agent-1.json
# │   └── agent-2.json
# └── features/          # Feature-based collaboration
#     ├── feature-123/
#     │   ├── feature.json
#     │   ├── tasks.json
#     │   └── delegations.json
#     └── feature-456/
```

### HTTP Dashboard (Development):
```bash
pnpm run dev  # Start HTTP server on port 3737
```

### Debug Logging:
```bash
DEBUG=agent-hub:* node dist/index.js
```

## Future Architecture Considerations

### Planned Enhancements:
- **Database Backend** - Replace file storage for high-volume scenarios
- **Web Dashboard** - Real-time monitoring interface
- **Authentication** - Multi-user and remote access support
- **Streaming APIs** - Real-time event streaming
- **Microservice Split** - Separate services for different concerns

### Architecture Evolution:
```mermaid
graph TB
    subgraph "Current (v0.2)"
        MONO[Monolithic MCP Server]
        FILE[File-based Storage]
        LOCAL[Local-only Access]
    end
    
    subgraph "Future (v1.0+)"
        DB[Database Backend]
        REMOTE[Remote Access Support]
        DASH[Web Dashboard]
        AUTH[Authentication Layer]
    end
    
    MONO --> DASH
    FILE --> DB
    LOCAL --> REMOTE
    REMOTE --> AUTH
```

This architecture provides a solid foundation for multi-agent collaboration while maintaining simplicity and reliability for local development scenarios.
