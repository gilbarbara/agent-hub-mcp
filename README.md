# MCP Agent Hub

A Model Context Protocol (MCP) server that enables communication and coordination between multiple Claude Code agents working across different repositories in a multi-service architecture.

## Features

- 🔄 **Real-time Communication**: Agent-to-agent messaging with Server-Sent Events (SSE)
- 📦 **Shared Context Store**: Cross-repository state management
- 📋 **Task Coordination**: Track and manage dependencies between agents
- 🆔 **Smart Agent Registration**: Automatic project-based ID generation
- 💾 **Persistent Storage**: File-based persistence in `.agent-hub` directory
- 🌐 **HTTP Transport**: Modern HTTP/SSE transport with auto-registration

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start the Server

```bash
# Development mode (recommended)
pnpm run dev

# Production mode
pnpm run build
pnpm run start
```

Server starts on `http://localhost:3737/mcp`

### 3. Configure Claude Code

Add to your Claude Code settings:

```json
{
  "mcpServers": {
    "agent-hub": {
      "type": "http",
      "url": "http://localhost:3737/mcp"
    }
  }
}
```

### 4. Register Your Agent

In Claude Code, your agent will auto-register when it first connects:

```javascript
// Agent automatically registers with project-based ID
register_agent({
  projectPath: "/path/to/your/project",
  role: "Your role description"
})
// Generated ID: "project-name-x3k2m"
```

## Core Concepts

### Agent Registration

Agents are automatically identified by their project directory with a unique suffix:
- Pattern: `projectName-randomSuffix` (e.g., `frontend-x3k2m`)
- Supports multiple agents per project
- No manual ID management required

### Message Types

- `context` - Share state/configuration
- `task` - Assign work to agents  
- `question` - Request information
- `completion` - Report task completion
- `error` - Report errors
- `sync_request` - Synchronous request/response

### Shared Context

Key-value store for cross-agent state:
- Versioning for conflict resolution
- TTL support for temporary data
- Namespace organization

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `send_message` | Send messages between agents |
| `get_messages` | Retrieve agent messages |
| `set_context` | Store shared state |
| `get_context` | Retrieve shared state |
| `register_agent` | Register an agent |
| `update_task_status` | Update task progress |
| `get_agent_status` | Check agent status |
| `start_collaboration` | Initialize feature work |
| `sync_request` | Synchronous communication |

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Claude Code specific guidance
- [HTTP Configuration](./docs/HTTP-CONFIG.md) - HTTP transport setup
- [Known Issues](./docs/KNOWN-ISSUES.md) - Current limitations and workarounds
- [Architecture](./docs/real-time-architecture.md) - System design
- [PRD](./docs/PRD.md) - Product requirements

## Known Issues

⚠️ See [KNOWN-ISSUES.md](./docs/KNOWN-ISSUES.md) for current limitations

Key issues:
- `resources/list_changed` notifications not handled by Claude Code
- Schema caching requires full restart for changes
- Optional parameters may still be required by client validation

## Development

### Commands

```bash
# Run tests
pnpm test

# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Build
pnpm run build
```

### Project Structure

```
.agent-hub/           # Persistent storage
├── agents/          # Agent registrations
├── messages/        # Message history
├── context/         # Shared context
└── tasks/           # Task tracking

src/
├── agents/          # Agent management (detection, registration, sessions)
├── context/         # Shared context service
├── messaging/       # Message handling
├── servers/         # HTTP/MCP/SSE servers
├── tasks/           # Task coordination
├── tools/           # MCP tool definitions
├── storage.ts       # File-based persistence
└── types.ts         # TypeScript types
```

### Storage

All data persists to `.agent-hub` directory:
- JSON file storage
- Atomic writes
- Automatic cleanup of old data

## Requirements

- Node.js 22+
- pnpm

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3737` | HTTP server port |
| `AGENT_HUB_DATA_DIR` | `.agent-hub` | Storage directory |

## Contributing

1. Check [Known Issues](./docs/KNOWN-ISSUES.md) first
2. File issues with reproduction steps
3. Include Claude Code and hub versions

## License

MIT

See [CLAUDE.md](./CLAUDE.md#implementation-status) for detailed status.
