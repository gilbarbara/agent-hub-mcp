# Troubleshooting Guide

## Gathering Debug Information

Before troubleshooting specific issues, gather this diagnostic information:

### System Information
```bash
# Check Node.js version (requires 22+)
node --version

# Check available MCP servers in Claude Code
# Look for "agent-hub" in the list

# Check Agent Hub MCP data directory
ls -la ~/.agent-hub/
ls -la ~/.agent-hub/messages/
ls -la ~/.agent-hub/agents/
```

### Enable Debug Logging
```bash
# For development mode
DEBUG=agent-hub:* pnpm run dev

# Or set environment variable
export DEBUG=agent-hub:*
```

### Verification Commands
```bash
# Test npx command directly
npx -y agent-hub-mcp@latest --help

# Check if Agent Hub MCP is responding
# Use your AI assistant's hub status command or ask it to check hub status
```

## Common Setup Issues

### MCP Server Not Connecting

**Problem**: Agent Hub MCP doesn't appear in your AI assistant
**Solutions**:
1. Verify `npx -y agent-hub-mcp@latest` command in config
2. Restart your AI assistant completely
3. Check file paths are absolute (for local installation)
4. Ensure Node.js 22+ is installed

### Agent Registration Fails

**Problem**: "Agent ID already registered with different project path"
**Solution**: 
- Use a different agent ID for the new project
- OR work from the original project path to reconnect

**Problem**: `agent: null` sessions in HTTP mode
**Solution**: This is normal until `register_agent` is called

### Commands Not Working

**Problem**: `/hub:register` or other commands not recognized
**Solutions**:
1. Ensure custom commands are copied to correct directory
2. For Claude Code: `~/.claude/commands/hub/`
3. For Qwen: `~/.qwen/commands/hub/`
4. Restart AI assistant after copying commands

## MCP Client Issues

### Schema Caching
**Problem**: Changes to tools don't appear
**Solution**: Restart Claude Code completely (schema is cached)

### Resource List Not Updating
**Problem**: New resources don't show automatically
**Solution**: Manually restart Claude Code

### Optional Parameters Required
**Problem**: Optional fields validated as required
**Solution**: Provide all fields even if marked optional

## Storage & Permissions

### File Permission Errors
**Problem**: Cannot write to `.agent-hub` directory
**Solutions**:
1. Check write permissions: `ls -la ~/.agent-hub`
2. Create directory manually: `mkdir -p ~/.agent-hub`
3. Set permissions: `chmod 755 ~/.agent-hub`

### Data Directory Issues
**Problem**: Data not persisting between sessions
**Solutions**:
1. Set `AGENT_HUB_DATA_DIR` environment variable
2. Use absolute path in configuration
3. Verify directory exists and is writable

## Transport Issues

### stdio Transport Not Working
**Checklist**:
- ✅ Run `pnpm build` (if local installation)
- ✅ Verify `dist/index.js` exists
- ✅ Use absolute paths in configuration
- ✅ Set `AGENT_HUB_DATA_DIR` if needed

### HTTP Transport Connection Issues
**Checklist**:
- ✅ Server running on port 3737 (`pnpm run dev`)
- ✅ No firewall blocking localhost
- ✅ Correct URL: `http://localhost:3737/mcp`

## Message Delivery

### Messages Not Received
**Problem**: Agent not seeing messages from other agents
**Solutions**:
1. Use `get_messages` to manually check
2. Verify both agents are registered
3. Check `.agent-hub/messages/` directory
4. Ensure correct agent IDs in `send_message`

### Context Not Syncing
**Problem**: Shared context not appearing
**Solutions**:
1. Context updates are immediate but require manual check
2. TTL may have expired (check TTL settings)
3. Verify namespace is correct

## Performance Issues

### High Memory Usage
**Causes & Solutions**:
- Large context values → Use TTL for temporary data
- Many old messages → Implement cleanup routines
- All context loaded at startup → Consider smaller values

### Slow File Operations
**Causes & Solutions**:
- File locking under high load → Normal behavior for consistency
- Large `.agent-hub` directory → Clean up old data periodically
- Many concurrent operations → Consider database backend for scale

## Debug Mode

Enable detailed logging:
```bash
DEBUG=agent-hub:* pnpm run dev
```

Check logs for:
- Agent registration events
- Message delivery confirmation
- Storage operations
- Error details

## Still Having Issues?

1. Check [Known Issues](./KNOWN-ISSUES.md)
2. Search existing [GitHub Issues](https://github.com/gilbarbara/agent-hub-mcp/issues)
3. File new issue with:
   - AI assistant version
   - Node.js version
   - Error messages
   - Configuration used
   - Steps to reproduce