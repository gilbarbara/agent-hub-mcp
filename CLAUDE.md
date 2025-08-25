# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Multi-Agent Collaboration System

**You are part of a collaborative multi-agent system!** The Agent Hub MCP enables communication between multiple Claude Code instances working on different projects.

### On Session Start:

1. **Register with the hub** (if not already registered):
   - Use `mcp__agent-hub__register_agent` with project-based ID
   - Notify user: "Connected to Agent Hub as [agent-id]"

2. **Check for collaboration messages**:
   - Use `mcp__agent-hub__get_messages` periodically
   - Inform user of any pending messages from other agents
   - Example: "📬 You have 3 messages from frontend-agent about API changes"

3. **Share your work context**:
   - When making significant changes, use `mcp__agent-hub__send_message` to notify other agents
   - Use `mcp__agent-hub__set_context` to share important state

### During Work:

- **Be proactive about collaboration**: Check for messages when working on interfaces, APIs, or shared components
- **Announce major changes**: Inform other agents about breaking changes or new features
- **Respond to sync requests**: Other agents may need immediate answers via `sync_request`

## Project Overview

Agent Hub MCP is a Model Context Protocol (MCP) server that enables communication and coordination between multiple Claude Code agents working across different repositories in a multi-service architecture. It provides:
- Centralized message broker for agent-to-agent communication
- Shared context store for cross-repository state
- Task coordination and dependency tracking
- File-based persistence in `.agent-hub` directory

## Commands

### Development
```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build server
pnpm run build

# Start HTTP MCP server (recommended)
pnpm run dev

# Production HTTP server
pnpm run start
```

## Quick Start

### 1. Start the HTTP Server (Recommended)
```bash
pnpm install
pnpm run dev
# Server starts on http://localhost:3737/mcp
```

### 2. Configure Claude Code
Add to your Claude Code settings:
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
You can use `tsx` (global) instead of node during development:

```
{
  "mcpServers": {
    "agent-hub": {
      "command": "tsx",
      "args": ["/path/to/agent-hub-mcp/src/index.ts"]
    }
  }
}
```

### 3. Test Multi-Agent Collaboration
- Open multiple Claude Code instances in different projects
- Use messages, shared context, and task coordination

For detailed setup instructions, see [HTTP-CONFIG.md](./HTTP-CONFIG.md).

## Architecture

### Core System Design
The hub operates as an MCP server with **two transport options**:

**HTTP Transport (Recommended)**:
- Better scalability and remote access
- Session management with persistent connections

**stdio Transport (Legacy)**:
- Process-based communication
- Manual registration required
- Limited to local connections

Each agent:
1. Auto-registers with identifier and capabilities (HTTP) or manually registers (stdio)
2. Can send/receive messages with instant delivery (HTTP) or polling (stdio)
3. Can read/write to shared context store with live updates
4. Maintains persistent state in `.agent-hub` directory

### Key Data Models

**Message System**: Messages have types (context, task, question, completion, error, sync_request) and support threading, priority levels, and metadata.

**Shared Context**: Key-value store with versioning for conflict resolution, TTL support, and namespacing by feature/domain.

**Agent Registration**: Auto-detection from project directory with role, capabilities, and collaboration preferences.

### MCP Tools Interface
The server exposes tools for:
- `send_message` / `get_messages` - Asynchronous messaging
- `set_context` / `get_context` - Shared state management  
- `register_agent` / `update_task_status` / `get_agent_status` - Coordination
- `start_collaboration` / `sync_request` - Utility functions

### Storage Structure
```
.agent-hub/
├── messages/           # Persisted messages
├── context/           # Shared context store
├── agents/            # Agent registrations
└── tasks/             # Task tracking
```

## Implementation Status

### ✅ **PRODUCTION READY** - Core Features Complete & Simplified

**Phase 1: MVP** ✅ **COMPLETED**
- ✅ Basic message send/receive with 9 MCP tools
- ✅ Simple key-value context store with namespacing and TTL
- ✅ File-based persistence in `.agent-hub` directory
- ✅ Agent identification and registration system
- ✅ MCP stdio server setup

**Phase 2: HTTP Transport** ✅ **COMPLETED**
- ✅ HTTP MCP server with Express.js on port 3737
- ✅ Manual registration system with project-based ID generation
- ✅ Server-Sent Events (SSE) support
- ✅ Session management (supports null agents until registration)
- ✅ Project-based agent detection and capability inference

**Phase 3: Core Features** ✅ **COMPLETED**  
- ✅ Task management and dependency tracking
- ✅ Priority messaging (urgent, normal, low)
- ✅ Synchronous request/response via sync_request tool
- ✅ Message threading support with threadId
- ✅ Comprehensive test suite with storage coverage

**Phase 4: Production Hardening** ✅ **COMPLETED**
- ✅ Complete documentation (CLAUDE.md, HTTP-CONFIG.md, KNOWN-ISSUES.md)
- ✅ Health check endpoints (/ping)
- ✅ CORS support for browser clients
- ✅ DNS rebinding protection for security
- ✅ Build scripts for both transport types

**Phase 5: Architecture Cleanup (December 2024)** ✅ **COMPLETED**
- ✅ Removed experimental notification bridge/webhook system
- ✅ Removed heartbeat service (unnecessary complexity)
- ✅ Removed auto-registration (caused orphaned files)  
- ✅ Removed agent elicitation/approval system (over-engineered)
- ✅ Simplified codebase by ~25% while maintaining all core functionality
- ✅ Reduced TypeScript errors from 76 → 0
- ✅ Build size reduced 12% (65KB → 57KB)

### 🚧 **Future Enhancements**
- [ ] Web dashboard for monitoring active agents
- [ ] CLI for manual interaction and debugging  
- [ ] Enhanced SSE streaming implementation
- [ ] Authentication and authorization
- [ ] Performance metrics and analytics

## Known Issues & Limitations

### Claude Code Integration Issues

1. **MCP Schema Caching**: Claude Code may cache MCP tool schemas, requiring a full restart when schema changes (e.g., making fields optional)

2. **resources/list_changed Notification**: Currently not properly handled by Claude Code
   - The notification is sent but Claude Code doesn't refresh its resource list
   - Tracking issue: [GitHub Issue TBD]
   - Workaround: Manually restart Claude Code to see new resources

3. **Optional Tool Parameters**: Claude Code's client-side validation may still require fields marked as optional in the schema
   - Example: `id` field in `register_agent` tool
   - Workaround: Provide all fields even if marked optional

### Session Management (Updated December 2024)

The system now uses a **single-step registration** process:
- No temporary session files are created during discovery
- Agents register directly with project-based IDs
- ID generation pattern: `project-name-randomSuffix` (e.g., `helpers-x3k2m`)
- Supports multiple agents per project safely with random suffixes

**Important**: Sessions without registered agents (`agent: null`) are normal and expected until the agent calls `register_agent`

## Development Guidelines

When implementing features:
1. Follow TypeScript interfaces defined in the PRD (Message, SharedContext, AgentRegistration)
2. Ensure all data persists to `.agent-hub` directory for recovery
3. Use atomic operations for context updates to prevent conflicts
4. Implement proper error handling with defined error codes
5. Keep message latency under 100ms for local operations

## Configuration

Agents can be configured via `.agent-hub.json` in their repository:
```json
{
  "agent": "backend",
  "role": "API and business logic implementation",
  "capabilities": ["api-design", "database-schema"],
  "collaborates_with": ["frontend", "hub"]
}
```

MCP server configuration goes in Claude Code settings:

**stdio Transport (Recommended)**:
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

**HTTP Transport (Alternative)**:
```json
{
  "mcpServers": {
    "agent-hub": {
      "url": "http://localhost:3737/mcp"
    }
  }
}
```

*Note: For HTTP transport, start server with `pnpm run dev:http`*

See [HTTP-CONFIG.md](./HTTP-CONFIG.md) for detailed HTTP setup instructions.
