# Known Issues and Limitations

## Last Updated: December 2024

This document tracks known issues, limitations, and workarounds for the Agent Hub MCP.

## Claude Code Integration Issues

### 1. MCP Notifications Not Properly Handled

#### resources/list_changed
- **Status**: 🔴 Not Working
- **Issue**: Claude Code receives the notification but doesn't refresh its internal resource list
- **Impact**: New resources added dynamically are not visible in Claude Code
- **Workaround**: Restart Claude Code to force refresh of resources
- **Tracking**: [Issue to be filed with Anthropic]

#### tools/list_changed
- **Status**: 🟡 Partially Working
- **Issue**: Similar to resources, tool list updates may not be reflected
- **Workaround**: Restart Claude Code

### 2. Schema Caching Issues

- **Status**: 🟡 Workaround Available
- **Issue**: Claude Code aggressively caches MCP tool schemas
- **Impact**: Schema changes (like making fields optional) are not recognized
- **Example**: Changing `id` from required to optional in `register_agent` tool
- **Workaround**: 
  1. Stop Claude Code completely
  2. Rebuild the MCP server
  3. Start Claude Code fresh
- **Note**: Simply reloading the configuration is not sufficient

### 3. Optional Parameter Validation

- **Status**: 🟡 Workaround Available
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

- **Status**: 🟡 Framework Only
- **Issue**: SSE implementation is notification framework only, not true streaming
- **Impact**: Automatic updates require polling or manual refresh
- **Future**: Full SSE streaming implementation planned

### 2. Session Management

- **Status**: ✅ Fixed (December 2024)
- **Previous Issue**: Temporary session files were created and never cleaned up
- **Solution**: Implemented single-step registration with project-based IDs
- **Current Behavior**: 
  - Sessions start with `agent: null`
  - No temporary files created
  - Project-based ID generation: `project-name-randomSuffix`

## TypeScript Issues (December 2024)

### 1. All Major Issues Resolved ✅

- **Status**: ✅ **COMPLETED**
- **Previous Issues**: 
  - `src/sse-server.ts` - **REMOVED** (10 errors eliminated)
  - `src/agents/elicitation.ts` - **REMOVED** 
  - `src/notifications/bridge.ts` - **REMOVED**
  - `src/notifications/webhook.ts` - **REMOVED**
  - `src/notifications/preferences.ts` - **REMOVED**
- **Current Status**: **0 TypeScript errors** in production code
- **Impact**: Full type safety achieved

## Feature Limitations

### 1. Authentication

- **Status**: 🔴 Not Implemented
- **Impact**: No security for multi-user environments
- **Workaround**: Run on localhost only
- **Future**: OAuth/API key support planned

### 2. Persistence Limitations

- **Status**: 🟡 Basic Implementation
- **Current**: File-based storage in `.agent-hub` directory
- **Limitations**: 
  - No database support
  - No transaction support
  - Potential race conditions under heavy load
- **Future**: PostgreSQL/SQLite support planned

### 3. Scalability

- **Status**: 🟡 Single Instance Only
- **Limitations**:
  - No clustering support
  - No load balancing
  - Memory-based session storage
- **Recommended Max**: 10-20 concurrent agents

## Workaround Summary

| Issue | Quick Workaround |
|-------|------------------|
| Resources not updating | Restart Claude Code |
| Schema changes not recognized | Full restart + rebuild |
| Optional parameters failing | Provide all parameters |
| SSE not automatic | Use polling or manual refresh |
| Authentication needed | Run localhost only |
| High load issues | Limit concurrent agents |

## Reporting New Issues

To report new issues:
1. Check this document first
2. File issue at: https://github.com/[your-repo]/agent-hub-mcp/issues
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

### Q1 2025
- [ ] Full SSE streaming implementation
- [ ] Better notification handling
- [ ] Schema hot-reload support

### Q2 2025
- [ ] Authentication system
- [ ] Database persistence
- [ ] Clustering support
