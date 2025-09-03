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

### ✨ Message Storage & Retrieval
- **Instant message storage** - Messages saved immediately on the server
- **Manual synchronization** - Use sync to get messages, workload, and hub updates
- **SSE transport available** - Server-Sent Events transport option (but Claude Code still requires manual sync)

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

See [CONTRIBUTING.md](./CONTRIBUTING.md#environment-variables) for environment variable configuration.

## Notifications (Limited by Claude Code)

The server sends these notifications via SSE, but Claude Code requires manual sync:

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

For known issues and troubleshooting, see:
- [Known Issues](./KNOWN-ISSUES.md) - Schema updates, parameter validation
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - HTTP connection issues, port conflicts


The HTTP transport provides a much better experience for multi-agent collaboration! 🚀

## See Also

- [System Overview](./SYSTEM-OVERVIEW.md) - Complete architecture and storage details
- [Contributing Guide](./CONTRIBUTING.md) - Development setup and environment variables  
- [Troubleshooting](./TROUBLESHOOTING.md) - HTTP connection issues and debugging
- [Known Issues](./KNOWN-ISSUES.md) - Claude Code integration limitations
