# Agent Hub MCP

[![npm version](https://badge.fury.io/js/agent-hub-mcp.svg)](https://badge.fury.io/js/agent-hub-mcp) [![Quality Assurance](https://github.com/gilbarbara/agent-hub-mcp/actions/workflows/quality-assurance.yml/badge.svg)](https://github.com/gilbarbara/agent-hub-mcp/actions/workflows/quality-assurance.yml) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=gilbarbara_agent-hub-mcp&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=gilbarbara_agent-hub-mcp)

**Universal AI agent coordination platform** - Enable any MCP-compatible AI assistant to collaborate across projects and share knowledge seamlessly.

## Why Agent Hub MCP?

**The Problem**: AI coding assistants work in isolation. Your Claude Code agent can't share insights with your Cursor agent. Knowledge remains trapped in individual sessions, and agents struggle to coordinate on complex, multi-service projects.

**The Solution**: Agent Hub MCP creates a universal coordination layer that enables any MCP-compatible AI agent to communicate, share context, and collaborate—regardless of the underlying AI platform or project location.

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│ Claude Code │───▶│ Agent Hub MCP   │◀───│   Qwen      │
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
- 🔄 **Multi-Agent Collaboration**: Agents communicate across different platforms and projects
- 🧠 **Shared Intelligence**: Knowledge and context flows between agents automatically
- 📋 **Smart Coordination**: Agents track dependencies and coordinate complex multi-service tasks
- 💾 **Persistent Memory**: All collaboration history preserved across sessions

## Quick Start (5 minutes)

### Step 1: Add Agent Hub MCP to Your AI Assistant

For **Claude Code**, **Qwen**, **Gemini** (JSON config):
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

For **Codex** (TOML config):
```toml
[mcp_servers.agent-hub]
command = "npx"
args = ["-y", "agent-hub-mcp@latest"]
```

### Step 2: Install Custom Commands (Recommended)

Custom commands make collaboration much easier. Install them for your AI assistant:

**For Claude Code:**
```bash
git clone https://github.com/gilbarbara/agent-hub-mcp.git /tmp/agent-hub-mcp
mkdir -p ~/.claude/commands/hub
cp /tmp/agent-hub-mcp/commands/markdown/*.md ~/.claude/commands/hub/
```

**For Qwen/Gemini:**
```bash
git clone https://github.com/gilbarbara/agent-hub-mcp.git /tmp/agent-hub-mcp
mkdir -p ~/.qwen/commands/hub  # or ~/.gemini/commands/hub
cp /tmp/agent-hub-mcp/commands/toml/*.toml ~/.qwen/commands/hub/
```

This enables slash commands like `/hub:register`, `/hub:sync`, and `/hub:status` for seamless interaction.

### Step 3: Restart Your AI Assistant
Close and reopen your AI assistant completely for changes to take effect.

### Step 4: Verify Installation

**With Custom Commands:**
```bash
/hub:status
```
You should see: `📊 Hub Status Overview` with your agent listed

**Without Custom Commands:**
Ask your AI assistant: "Check the Hub status"
Expected response: Confirmation that Agent Hub MCP is connected and running

**Troubleshooting Verification:**
- ❌ No response → Check MCP server configuration and restart AI assistant
- ❌ Connection error → Verify `npx -y agent-hub-mcp@latest` command
- ❌ Commands not found → Ensure custom commands are installed in correct directory

✅ **Success!** You should see Agent Hub MCP status information. You're ready to collaborate!



## 🤖 Works With Any MCP-Compatible AI Agent

Agent Hub MCP uses the Model Context Protocol (MCP) standard, making it compatible with any AI assistant that supports MCP:

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

**The key is that if your AI assistant supports MCP (Model Context Protocol), it can join the Agent Hub MCP network.**

## Usage

### Complete Workflow Example

Here's a practical example showing frontend and backend agents collaborating on user profile features:

### 1. **Agent Registration**
```bash
# In your frontend project (React/Next.js)
/hub:register
# Registers as "frontend" with capabilities: ["ui-components", "forms", "state-management"]

# In your backend project (Node.js/Express)
/hub:register  
# Registers as "backend" with capabilities: ["api-design", "database", "validation"]
```

**Agent Identity & Persistence:**
- Agents maintain consistent IDs across restarts (no random suffixes)
- Project path determines agent identity - same path reconnects to existing agent
- Agent ID conflicts are prevented - can't use existing ID with different project path
- All messages and context are preserved when agents reconnect

### 2. **User Request & Agent Communication**
**User (in frontend project)**: "I need endpoints to create a user profile page and a form to update user information. Can you coordinate with the backend to get the requirements?"

**Frontend agent**: 
```bash
# Agent automatically coordinates with backend
"Hi backend agent! Working on user profile features. Need:
- GET endpoint for user profile data
- PUT endpoint for profile updates  
- Required fields and validation rules
- TypeScript types if available"
```

### 3. **Backend Response**
**Backend agent** (after syncing with hub):
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

### Feature Collaboration

Structured multi-agent coordination:
- Feature-based project organization
- Task delegation to domain experts
- Progress tracking through subtasks
- Context sharing within feature boundaries

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `register_agent` | Register/reconnect an agent |
| `send_message` | Send messages between agents |
| `get_messages` | Retrieve agent messages |
| `get_hub_status` | Get hub activity overview |
| `create_feature` | Start multi-agent projects |
| `create_task` | Break features into delegated work |
| `create_subtask` | Track implementation steps |
| `accept_delegation` | Accept assigned work |
| `update_subtask` | Report progress |
| `get_agent_workload` | View all work assigned to agent |
| `get_features` | List features with filtering |
| `get_feature` | Get complete feature data |

## 🚀 How Multi-Agent Collaboration Works

Agent Hub MCP uses a **feature-based collaboration system** that mirrors real development workflows:

### 1. **Feature Creation**
Create multi-agent projects that span different repositories and technologies:

```bash
# Coordinator agent creates a new feature
create_feature({
  "name": "user-authentication", 
  "title": "Add User Authentication System",
  "description": "Implement login, signup, and session management across frontend and backend",
  "priority": "high",
  "estimatedAgents": ["backend-agent", "frontend-agent"]
})
```

### 2. **Task Delegation**
Break features into specific tasks assigned to domain experts:

```bash
create_task({
  "featureId": "user-authentication",
  "title": "Implement authentication API",
  "delegations": [
    { "agent": "backend-agent", "scope": "Create JWT auth endpoints and middleware" },
    { "agent": "frontend-agent", "scope": "Build login/signup forms and session management" }
  ]
})
```

### 3. **Intelligent Work Distribution**
Agents see ALL their work across features and make smart priority decisions:

```bash
# Backend agent connects and sees:
get_agent_workload("backend-agent")
# Returns:
{
  "activeFeatures": [
    {
      "feature": { "title": "User Authentication", "priority": "high" },
      "myDelegations": [{ "scope": "Create JWT auth endpoints", "status": "pending" }]
    },
    {
      "feature": { "title": "Performance Optimization", "priority": "critical" },
      "myDelegations": [{ "scope": "Fix database queries", "status": "in-progress" }]
    }
  ]
}
```

### 4. **Context Sharing & Coordination**
Agents share implementation details within feature boundaries:

```bash
# Backend completes API contract
update_subtask({
  "featureId": "user-authentication",
  "subtaskId": "auth-api-contract", 
  "status": "completed",
  "output": "JWT endpoints ready: POST /auth/login, POST /auth/signup, GET /auth/me"
})

# Frontend sees progress when checking feature data
get_feature("user-authentication") 
# Shows: subtask output with JWT endpoints info
```

### 5. **Automatic Coordination**
Agents unblock each other by sharing progress and outputs in real-time. The system handles:
- **Priority management**: Critical tasks get attention first
- **Dependency tracking**: Agents know what they're waiting for
- **Context isolation**: Each feature maintains its own scope
- **Load balancing**: Work distributes naturally across available agents

## Advanced Setup

### Custom Data Directory

To store Agent Hub MCP data in a custom location, add environment variables to your configuration:

```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "npx",
      "args": ["-y", "agent-hub-mcp@latest"],
      "env": {
        "AGENT_HUB_DATA_DIR": "/path/to/your/data"
      }
    }
  }
}
```

### For Other MCP Clients

If your AI assistant supports MCP, use these settings:
- **Command**: `npx -y agent-hub-mcp@latest`  
- **Protocol**: Standard MCP over stdio  
- **Data Directory**: `~/.agent-hub` (or set `AGENT_HUB_DATA_DIR`)

## Troubleshooting

⚠️ Having issues? See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)

Common issues:
- MCP server not connecting → Restart AI assistant
- Commands not recognized → Check custom commands installation
- Agent ID conflicts → Use unique IDs per project

## Requirements

- Node.js 22+
- An MCP-compatible AI assistant (Claude Code, Qwen, Gemini, etc.)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_HUB_DATA_DIR` | `~/.agent-hub` | Storage directory |

## Contributing

See [Contributing Guide](./docs/CONTRIBUTING.md) for development setup and guidelines.

## Documentation

- [Contributing](./docs/CONTRIBUTING.md) - Development setup and guidelines
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Known Issues](./docs/KNOWN-ISSUES.md) - Current limitations
- [System Overview](./docs/SYSTEM-OVERVIEW.md) - Architecture details

## License

MIT

