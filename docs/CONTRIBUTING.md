# Contributing to Agent Hub MCP

## Development Setup

### Prerequisites
- Node.js 22+
- pnpm

### Local Installation
```bash
git clone https://github.com/gilbarbara/agent-hub-mcp.git
cd agent-hub-mcp
pnpm install
pnpm build
```

### Configure for Local Development
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

For TypeScript development without build step:
```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "tsx",
      "args": ["/path/to/agent-hub-mcp/src/index.ts"]
    }
  }
}
```

## Development Commands

```bash
pnpm test          # Run test suite
pnpm run typecheck # Type checking
pnpm run lint      # Linting
pnpm run build     # Build project
pnpm run dev       # Start HTTP server (port 3737)
pnpm run coverage  # Test coverage report
```

## Testing

Testing is a core part of our development process:

### Test Types
- **Unit Tests**: Service layer testing with mocks
- **Integration Tests**: File system storage validation
- **Multi-Agent Tests**: Cross-agent communication scenarios
- **Coverage Goal**: >90% coverage on core services

### Running Tests
```bash
pnpm test          # Run full test suite
pnpm run coverage  # Generate coverage report
pnpm test -- --watch # Watch mode for development
```

### Writing Tests
- Follow existing test patterns in `test/` directory
- Mock external dependencies using `vi.fn()`
- Test both success and failure scenarios
- Ensure tests are isolated and don't depend on external state

## Project Structure

```
src/
├── agents/          # Agent management (detection, registration, sessions)
├── messaging/       # Message handling
├── features/        # Multi-agent collaboration system
├── servers/         # HTTP/MCP servers
├── tools/           # MCP tool definitions
├── storage/         # File-based persistence
├── validation/      # Input validation and security
└── types.ts         # TypeScript types
```

## Storage Structure

```
.agent-hub/           # Persistent storage
├── agents/          # Agent registrations
├── messages/        # Message history
└── features/        # Feature collaboration data
    ├── features.json
    ├── tasks.json
    ├── delegations.json
    └── subtasks.json
```


## HTTP Transport Development

For testing or debugging with HTTP transport:

```bash
# Start HTTP server
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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3737` | HTTP server port |
| `AGENT_HUB_DATA_DIR` | `~/.agent-hub` | Storage directory path |
| `DEBUG` | - | Enable debug logging (`DEBUG=agent-hub:*`) |

### Usage Examples

```bash
# Custom storage directory
AGENT_HUB_DATA_DIR=/custom/path/.agent-hub pnpm run dev

# Custom HTTP port  
PORT=5000 pnpm run dev

# Enable debug logging
DEBUG=agent-hub:* pnpm run dev

# Combined
AGENT_HUB_DATA_DIR=/custom/path PORT=5000 DEBUG=agent-hub:* pnpm run dev
```

## Debugging

- **HTTP Mode**: Use `pnpm run dev` for browser debugging tools
- **File System**: Check `.agent-hub/` directory for persisted state
- **Logs**: Enable debug logging with `DEBUG=agent-hub:*`
- **Network**: Monitor SSE connections in browser dev tools

## Contributing Guidelines

1. Check [Known Issues](./KNOWN-ISSUES.md) before starting
2. File issues with clear reproduction steps
3. Include versions (Node.js, Claude Code, Agent Hub)
4. Follow existing code patterns and conventions
5. Add tests for new functionality
6. Update documentation as needed

## Code Quality

Before submitting:
1. Run `pnpm run lint` and fix issues
2. Run `pnpm run typecheck` for type safety
3. Run `pnpm test` to ensure all tests pass
4. Update relevant documentation

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request with clear description

## Questions?

Open an issue or discussion on GitHub for help.

## See Also

- [System Overview](./SYSTEM-OVERVIEW.md) - Complete architecture and design patterns
- [HTTP Configuration](./HTTP-CONFIG.md) - HTTP transport setup for development
- [Troubleshooting](./TROUBLESHOOTING.md) - Common development issues and solutions  
- [Known Issues](./KNOWN-ISSUES.md) - Current limitations to be aware of
