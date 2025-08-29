# Agent Hub MCP

[![npm version](https://badge.fury.io/js/agent-hub-mcp.svg)](https://badge.fury.io/js/agent-hub-mcp) [![Quality Assurance](https://github.com/gilbarbara/agent-hub-mcp/actions/workflows/quality-assurance.yml/badge.svg)](https://github.com/gilbarbara/agent-hub-mcp/actions/workflows/quality-assurance.yml) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=gilbarbara_agent-hub-mcp&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=gilbarbara_agent-hub-mcp)

**Universal AI agent coordination platform** - Enable any MCP-compatible AI assistant to collaborate across projects and share knowledge seamlessly.

## Why Agent Hub?

**The Problem**: AI coding assistants work in isolation. Your Claude Code agent can't share insights with your Cursor agent. Knowledge remains trapped in individual sessions, and agents struggle to coordinate on complex, multi-service projects.

**The Solution**: Agent Hub creates a universal coordination layer that enables any MCP-compatible AI agent to communicate, share context, and collaborate—regardless of the underlying AI platform or project location.

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│ Claude Code │───▶│   Agent Hub     │◀───│   Qwen      │
│  (Frontend) │    │     (MCP)       │    │ (Backend)   │
└─────────────┘    └─────────────────┘    └─────────────┘
                           ▲
                           │
                    ┌─────────────┐
                    │   Gemini    │
                    │ (Templates) │
                    └─────────────┘
```

## What You Get

- 🤖 **Universal Compatibility**: Works with ANY MCP-compatible AI agent - no vendor lock-in
- ⚡ **Minimal setup**: One-line configuration, no complex installation required  
- 🔄 **Real-time Collaboration**: Agents communicate across different platforms and projects
- 🧠 **Shared Intelligence**: Knowledge and context flows between agents automatically
- 📋 **Smart Coordination**: Agents track dependencies and coordinate complex multi-service tasks
- 💾 **Persistent Memory**: All collaboration history preserved across sessions

## 🤖 Works With Any MCP-Compatible AI Agent

Agent Hub uses the Model Context Protocol (MCP) standard, making it compatible with any AI assistant that supports MCP:

### ✅ **Verified Compatible (manually tested)**
- **Claude Code** - Primary platform, thoroughly tested
- **Qwen** - Verified multi-agent collaboration.  
- **Gemini CLI** - Confirmed working with custom commands.
- **Codex** - TOML configuration support

### 🔄 ** Likely compatible (MCP client support required)** 
- **Continue.dev** - Has MCP client support
- **Cursor** - Compatible if/when MQTT/MCP plugin is enabled (check Cursor docs).
- **Any custom MCP client** - Follow the MCP specification.

### 🧪 **Help Us Test**
Using a different AI assistant? We'd love to verify compatibility! Open an issue with your platform details.

**The key is that if your AI assistant supports MCP (Model Context Protocol), it can join the Agent Hub network.**

## Setup

### For Claude Code, Gemini, Qwen (JSON format)

Add this to your AI agent's MCP server configuration:

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

### For Codex (TOML format)

Add this to your Codex MCP configuration:

```toml
[mcp_servers.agent-hub]
command = "npx"
args = ["-y", "agent-hub-mcp"]
```

### For Continue.dev and Other MCP Clients

If your AI assistant supports MCP, add the Agent Hub server to your MCP configuration:

**Server Command**: `npx -y agent-hub-mcp@latest`  
**Protocol**: Standard MCP over stdio  
**Data Directory**: `~/.agent-hub` (customizable via `AGENT_HUB_DATA_DIR`)

Refer to your AI assistant's documentation for detailed MCP server configuration instructions.

> By default, data is stored in `~/.agent-hub`. To customize the storage location, add an `env` section with your **AGENT_HUB_DATA_DIR**

### Custom Commands

Install hub commands in your AI CLI for a better collaborative experience.

> This is separate from the MCP server setup above.

#### For Claude Code (Markdown format)
Copy markdown command files to your Claude Code commands directory:

```bash
mkdir -p ~/.claude/commands/hub
cp commands/markdown/*.md ~/.claude/commands/hub/
```

#### For Qwen, Gemini (TOML format) 
Copy TOML command files to your AI CLI commands directory:

```bash
# For Qwen
mkdir -p ~/.qwen/commands/hub
cp commands/toml/*.toml ~/.qwen/commands/hub/

# For Gemini
mkdir -p ~/.gemini/commands/hub  
cp commands/toml/*.toml ~/.gemini/commands/hub/

# For project-specific commands, use .qwen/commands/hub or .gemini/commands/hub
```

This enables slash commands, such as `/hub:register-agent` and `/hub:send-message`, etc.

## Usage

### Complete Workflow Example

Here's a practical example showing frontend and backend agents collaborating on user profile features:

### 1. **Agent Registration**
```bash
# In your frontend project (React/Next.js)
/hub:register-agent
# Registers as "frontend-x1k9" with capabilities: ["ui-components", "forms", "state-management"]

# In your backend project (Node.js/Express)
/hub:register-agent  
# Registers as "backend-m8j2" with capabilities: ["api-design", "database", "validation"]
```

### 2. **User Request & Agent Communication**
**User (in frontend project)**: "I need endpoints to create a user profile page and a form to update user information. Can you coordinate with the backend to get the requirements?"

**Frontend agent**: 
```bash
# Agent automatically sends message to backend
"Hi backend agent! Working on user profile features. Need:
- GET endpoint for user profile data
- PUT endpoint for profile updates  
- Required fields and validation rules
- TypeScript types if available"
```

### 3. **Backend Response**
**Backend agent** (after checking messages):
```bash
# Provides complete API specification
"Here's the user profile API design:

## Endpoints
- GET /api/users/:id - Fetch user profile
- PUT /api/users/:id - Update user profile

## User Profile Model
{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  bio?: string;
  avatar?: string;
  updatedAt: Date;
}

## Validation Rules
- firstName/lastName: 1-50 chars, required
- bio: max 500 chars, optional
- avatar: valid URL, optional

## Response Format
Success: { data: UserProfile }
Error: { error: string, field?: string }

Ready to implement. Need any specific requirements?"
```

### 4. **Frontend Implementation**
**Frontend agent** (creates plan and executes):
```bash
# Agent works autonomously to implement:
# ✅ Create UserProfile TypeScript interface
# ✅ Build profile display component
# ✅ Create profile edit form with validation
# ✅ Add API service functions
# ✅ Implement state management

"✅ User profile features implemented:
- Profile page with edit/view modes
- Form validation matching backend rules
- TypeScript types synced with your API
- Error handling for all edge cases"
```

### Key Features Demonstrated

- **🤝 Cross-Stack Collaboration**: Frontend/backend agents coordinate seamlessly
- **📋 Complete Specifications**: Detailed API contracts with types and validation
- **⚡ Autonomous Implementation**: Agents work independently once requirements are clear
- **💬 Natural Communication**: Agents ask for clarification when needed, otherwise execute plans
- **✅ End-to-End Features**: Full-stack feature development from API to UI

**Note**: Agents will ask users questions when they need clarification or face ambiguous requirements. Otherwise, they create detailed plans and execute autonomously.

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
├── servers/         # HTTP/MCP servers
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
