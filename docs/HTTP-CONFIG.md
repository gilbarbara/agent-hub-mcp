# Agent Hub MCP HTTP Configuration

The Agent Hub MCP now supports **fast collaboration** via HTTP transport with Server-Sent Events (SSE)!

## Quick Start

### 1. Start the HTTP Server
```bash
# Development mode
pnpm run dev:http

# Production mode  
pnpm run build
pnpm run start:http

# Custom port
PORT=5000 pnpm run dev
```

### 2. Configure Claude Code

Replace your stdio configuration with the HTTP URL:

**Before (stdio):**
```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "tsx",
      "args": ["/Users/gilbarbara/projects/agent-hub-mcp/src/stdio-server.ts"],
      "env": {
        "AGENT_HUB_DATA_DIR": "/Users/gilbarbara/.agent-hub"
      }
    }
  }
}
```

**After (HTTP):**
```json
{
  "mcpServers": {
    "agent-hub": {
      "url": "http://localhost:3737/mcp"
    }
  }
}
```

## Features

### ✨ Fast Communication
- **Instant message delivery** - No more polling for messages
- **Live notifications** - Agent join/leave, context updates, task changes  
- **SSE streaming** - Server-Sent Events for instant updates

### 🔄 Session Management
- **Persistent connections** - Maintain state across requests
- **Session isolation** - Each agent gets its own session
- **Graceful cleanup** - Automatic cleanup when agents disconnect

## API Endpoints

### Health Check
```bash
GET /ping
# Returns: {"status":"ok","timestamp":1234567890}
```

### MCP Protocol
```bash
POST /mcp    # Send MCP requests
GET /mcp     # Receive SSE notifications  
DELETE /mcp  # Terminate session
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `AGENT_HUB_DATA_DIR` | `.agent-hub` | Data storage directory |

## Instant Notifications

Agents automatically receive these notifications via SSE:

- `agent_joined` - New agent connected
- `agent_left` - Agent disconnected  
- `new_message` - Message received
- `context_updated` - Shared context changed
- `task_updated` - Task status changed

## Migration Guide

### From stdio to HTTP

1. **Start HTTP server**: `pnpm run dev`
2. **Update Claude Code config**: Change `command/args` to `url`
3. **Restart Claude Code**: Reload to use new config
4. **Test**: Send messages between agents

### Dual Mode Support

You can run both stdio and HTTP servers simultaneously:

```bash
# Terminal 1: stdio server (port varies)
pnpm run dev:stdio

# Terminal 2: HTTP server (port 3737)  
pnpm run dev
```

Configure different Claude Code instances to use different transports.

## Agent Registration (Updated December 2024)

### Automatic Project-Based IDs

The hub now generates agent IDs automatically from the project path:

```javascript
// Before: Manual ID required
register_agent({
  id: "my-agent",
  projectPath: "/Users/name/my-project",
  role: "Frontend Developer"
})

// After: ID auto-generated from project path
register_agent({
  projectPath: "/Users/name/my-project",
  role: "Frontend Developer"
})
// Generated ID: "my-project-x3k2m" (random suffix for uniqueness)
```

### Registration Flow

1. **Session Initialization**: When Claude Code connects, a session is created with `agent: null`
2. **Agent Registration**: The agent calls `register_agent` to identify itself
3. **ID Generation**: If no ID provided, generates `projectName-randomSuffix`
4. **Multi-Agent Support**: Random suffixes allow multiple agents per project

### Important Notes

- No temporary session files are created during discovery
- Sessions without agents (`agent: null`) are normal until registration
- Each project can have multiple agents with unique suffixes

## Known Issues & Workarounds

### Claude Code Integration

1. **resources/list_changed Not Working**
   - **Issue**: Claude Code doesn't refresh resource list when notification is sent
   - **Workaround**: Restart Claude Code to see new resources
   - **Status**: Tracking with Anthropic team

2. **Schema Caching**
   - **Issue**: Claude Code caches MCP tool schemas, not recognizing updates
   - **Workaround**: Full restart of Claude Code after schema changes
   - **Example**: Making `id` field optional in `register_agent`

3. **Optional Parameters Validation**
   - **Issue**: Client-side validation may require "optional" fields
   - **Workaround**: Always provide all fields even if marked optional

## Troubleshooting

### Port Conflicts
```bash
# Check what's using the port
lsof -i :3737

# Use a different port
PORT=3838 pnpm run dev
```

### Connection Issues
- Ensure server is running: `curl http://localhost:3737/ping`
- Check Claude Code logs for MCP errors
- Verify configuration syntax in Claude settings

### CORS Issues (if using browser clients)
The server includes CORS headers for development. For production:
- Configure `allowedOrigins` in the transport
- Enable DNS rebinding protection
- Use HTTPS for secure connections

The HTTP transport provides a much better experience for multi-agent collaboration! 🚀
