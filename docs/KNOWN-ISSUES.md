# Known Issues and Limitations

## Last Updated: August 2025

This document tracks known issues, limitations, and workarounds for the Agent Hub MCP.

## Severity Levels

- **🔴 Critical**: Blocks core functionality, no viable workaround
- **🟠 Major**: Significant impact, workaround available but complex  
- **🟡 Minor**: Low impact, easy workaround available
- **✅ Fixed**: Issue resolved in current version

## Claude Code Integration Issues

### 1. MCP Notifications Not Properly Handled

#### resources/list_changed
- **Severity**: 🟡 Minor
- **Status**: Not Working
- **Issue**: Claude Code receives MCP notifications but ignores them completely
- **Root Cause**: Claude Code uses pull-only model, doesn't process push notifications
- **Impact**: New resources added dynamically are not visible in Claude Code
- **Workaround**: Restart Claude Code to force refresh of resources
- **Tracking**: [Issue to be filed with Anthropic]

#### tools/list_changed
- **Severity**: 🟡 Minor
- **Status**: Partially Working
- **Issue**: Similar to resources, tool list updates may not be reflected
- **Workaround**: Restart Claude Code

### 2. Claude Code Pull-Only Architecture

- **Severity**: 🟠 Major
- **Status**: Fundamental Limitation
- **Issue**: Claude Code never automatically receives messages from MCP servers
- **Root Cause**: Request/response architecture - agents must manually query for messages
- **Impact**: No automatic message notifications, collaborative workflows require manual checking
- **Workaround**: Use external notifications (webhooks, terminal alerts) to prompt manual checking
- **Note**: This is architectural design, not a bug

### 3. Schema Caching Issues

- **Severity**: 🟡 Minor
- **Status**: Workaround Available
- **Issue**: Claude Code aggressively caches MCP tool schemas
- **Impact**: Schema changes (like making fields optional) are not recognized
- **Example**: Changing `id` from required to optional in `register_agent` tool
- **Workaround**: 
  1. Stop Claude Code completely
  2. Rebuild the MCP server
  3. Start Claude Code fresh
- **Note**: Simply reloading the configuration is not sufficient

### 4. Optional Parameter Validation

- **Severity**: 🟡 Minor
- **Status**: Workaround Available
- **Issue**: Claude Code's client-side validation may enforce "required" on optional fields
- **Impact**: Tools with optional parameters may fail validation
- **Workaround**: Always provide all parameters, even optional ones
- **Example**:
  ```javascript
  // May fail even though id is optional
  register_agent({
    projectPath: "/path",
    role: "Developer"
  })
  
  // Works reliably
  register_agent({
    id: "my-agent",
    projectPath: "/path",
    role: "Developer"
  })
  ```

## Server Implementation Issues

### 1. SSE Streaming Implementation

- **Severity**: 🟡 Minor
- **Status**: Framework Only
- **Issue**: SSE implementation is notification framework only, not true streaming
- **Impact**: Automatic updates require polling or manual refresh
- **Future**: Full SSE streaming implementation planned

### 2. Session Management

- **Severity**: ✅ Fixed
- **Status**: Fixed (August 2025)
- **Previous Issue**: Temporary session files were created and never cleaned up
- **Solution**: Implemented single-step registration with project-based IDs
- **Current Behavior**: 
  - Sessions start with `agent: null`
  - No temporary files created
  - Project-based ID generation: `project-name-randomSuffix`

## Feature Limitations

### 1. Persistence Limitations

- **Severity**: 🟠 Major
- **Status**: Basic Implementation
- **Current**: File-based storage in `.agent-hub` directory
- **Limitations**: 
  - No database support
  - No transaction support
  - Potential race conditions under heavy load
- **Future**: PostgreSQL/SQLite support planned

## Workaround Summary

| Issue | Quick Workaround |
|-------|------------------|
| No automatic message delivery | Use external notifications + manual checking |
| Resources not updating | Restart Claude Code |
| Schema changes not recognized | Full restart + rebuild |
| Optional parameters failing | Provide all parameters |
| SSE not automatic | Use polling or manual refresh |
| Authentication needed | Run localhost only |
| High load issues | Limit concurrent agents |

## Reporting New Issues

To report new issues:
1. Check this document first
2. File issue at: https://github.com/gilbarbara/agent-hub-mcp/issues
3. Include:
   - Claude Code version
   - Agent Hub MCP version
   - Steps to reproduce
   - Error messages/logs

## Version Compatibility

| Agent Hub MCP | Claude Code | Status |
|---------------|-------------|---------|
| 0.1.x | 1.0+ | ✅ Compatible |
| 0.2.x (current) | 1.0+ | ✅ Compatible with known issues |

## Planned Fixes

- [ ] Full SSE streaming implementation
- [ ] Better notification handling
- [ ] Schema hot-reload support
- [ ] Authentication system
- [ ] Database persistence
- [ ] Clustering support
