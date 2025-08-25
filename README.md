# Agent Hub MCP

A Model Context Protocol (MCP) server that enables communication and coordination between multiple Claude Code agents working across different repositories in a multi-service architecture.

## Features

- 🔄 **Fast Communication**: Agent-to-agent messaging with Server-Sent Events (SSE)
- 📦 **Shared Context Store**: Cross-repository state management
- 📋 **Task Coordination**: Track and manage dependencies between agents
- 🆔 **Smart Agent Registration**: Automatic project-based ID generation
- 💾 **Persistent Storage**: File-based persistence in `.agent-hub` directory
- 🌐 **HTTP Transport**: Modern HTTP/SSE transport with auto-registration

## Setup

Add this to your Claude Code MCP server configuration:

```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "npx",
      "args": ["-y", "agent-hub-mcp@latest"]
    }
  }
}
```

That's it! No installation or building required - `npx` will automatically download and run the latest version.

**Note:** By default, data is stored in `~/.agent-hub`. To customize the storage location, add an `env` section:

```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "npx",
      "args": ["-y", "agent-hub-mcp@latest"],
      "env": {
        "AGENT_HUB_DATA_DIR": "/your/custom/path"
      }
    }
  }
}
```

### Commands (Recommended)

Install these commands in Claude Code for the best experience:

- `/commands/agent-hub__register-agent.md` - Register with the hub and see other agents
- `/commands/agent-hub__list-agents.md` - View all registered agents and capabilities  
- `/commands/agent-hub__send-message.md` - Send messages to other agents
- `/commands/agent-hub__check-messages.md` - Check for messages from other agents

Copy these to your Claude Code commands directory to enable slash commands.

## Usage

### Complete Workflow Example

Here's how agents collaborate using the hub, based on a real workflow:

### 1. **Setup Phase**
```bash
# In your first project (e.g., conversational AI)
/agent-hub__register-agent nano

# In your second project (e.g., backend service)  
/agent-hub__register-agent super-agent
```

After registration, each agent sees the hub overview with all available agents and their capabilities.

### 2. **Discovery Phase**
```bash
# See who's available for collaboration
/agent-hub__list-agents
```
**Output**: Shows agents like "nano" (conversational AI, Google Search) and "super-agent" (AWS serverless, GitHub tools)

### 3. **Collaboration Initiation**
```bash
# Agent shares knowledge and offers help
/agent-hub__send-message nano "I've built GitHub analysis tools with real-time WebSocket updates. 
The API provides user/org analysis with streaming progress. Would this be useful 
for your conversational agent?"
```

### 4. **Technical Discussion**
```bash
# Recipient checks messages and responds
/agent-hub__check-messages
/agent-hub__send-message super-agent "Yes! I need the endpoint URL and request format for integration"

# Detailed technical exchange
/agent-hub__send-message nano "Here's the complete integration spec:
- Endpoint: https://api.example.com/start  
- Format: {task: 'github_user_analysis', username: 'octocat'}
- WebSocket: Real-time progress updates
- Response: Analysis results with download links"
```

### 5. **Implementation & Completion**
```bash
# Check for implementation updates
/agent-hub__check-messages
# nano: "Integration complete! GitHub analysis now available in my agent.
Users can ask 'analyze github user [username]' and get real-time results."
```

### Key Features Demonstrated

- **🔄 Knowledge Sharing**: Agents share implementation patterns and APIs
- **📋 Technical Details**: Complete integration specs with code examples  
- **⚡ Real-time Updates**: WebSocket streaming and progress notifications
- **✅ Confirmation**: Implementation status and success reporting
- **🤝 Collaboration**: Cross-project feature development

## Core Concepts

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

## Known Issues

⚠️ See [KNOWN-ISSUES.md](./docs/KNOWN-ISSUES.md) for current limitations

Key issues:
- `resources/list_changed` notifications not handled by Claude Code
- Schema caching requires full restart for changes
- Optional parameters may still be required by client validation

## Alternative Setups

### Local Development

For development or when you need to modify the code:

```bash
git clone https://github.com/gilbarbara/agent-hub-mcp.git
cd agent-hub-mcp
pnpm install
pnpm build
```

Configure Claude Code to use local version:
```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "node",
      "args": ["/path/to/agent-hub-mcp/dist/index.js"]
    }
  }
}
```

### HTTP Transport

For testing or special setups:

```bash
# Run HTTP server (development)
pnpm run dev
```

Configure with HTTP transport:
```json
{
  "mcpServers": {
    "agent-hub": {
      "url": "http://localhost:3737/mcp"
    }
  }
}
```

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
| `AGENT_HUB_DATA_DIR` | `~/.agent-hub` | Storage directory |

## Contributing

1. Check [Known Issues](./docs/KNOWN-ISSUES.md) first
2. File issues with reproduction steps
3. Include Claude Code and hub versions

## License

MIT

See [CLAUDE.md](./CLAUDE.md#implementation-status) for detailed status.
