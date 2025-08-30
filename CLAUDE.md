# CLAUDE.md - Agent Hub MCP Developer Guide

This file provides guidance to Claude Code (claude.ai/code) when working with the Agent Hub MCP codebase.

## Quick Start

### 1. Install & Build
```bash
pnpm install
pnpm run build
```

### 2. Configure Claude Code (stdio - Recommended)
Add to your Claude Code settings:
```json
{
  "mcpServers": {
    "agent-hub": {
      "command": "node",
      "args": ["/path/to/agent-hub-mcp/dist/index.js"],
      "env": {
        "AGENT_HUB_DATA_DIR": "/path/to/.agent-hub"
      }
    }
  }
}
```

For development with `tsx`:
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

### 3. Test Multi-Agent Collaboration
- Open multiple Claude Code instances in different projects
- Register each agent with `mcp__agent-hub__register_agent`
- Use messaging and context sharing tools

### Common Commands
```bash
pnpm test          # Run test suite
pnpm run dev       # Start HTTP server (port 3737)
pnpm run lint      # Check code quality
pnpm run coverage  # Test coverage report
```

## IMPORTANT: Multi-Agent Collaboration System

**You are part of a collaborative multi-agent system!** The Agent Hub MCP enables communication between multiple Claude Code instances working on different projects.

### On Session Start:

1. **Register with the hub**:
   - Use `mcp__agent-hub__register_agent` with project-based ID
   - Notify user: "Connected to Agent Hub as [agent-id]"

2. **Stay synchronized**:
   - Periodically check for messages, workload updates, and hub changes
   - Inform user of any pending collaboration work
   - Example: "📬 You have 3 messages from frontend-agent about API changes"

3. **Share your work context**:
   - When making significant changes, proactively notify other agents about relevant updates
   - Use feature tools to track progress and share context within project boundaries

### During Work:

- **Be proactive about collaboration**: Check for messages when working on interfaces, APIs, or shared components
- **Announce major changes**: Inform other agents about breaking changes or new features
- **Respond to direct questions**: Other agents may send questions via messages

## Architecture Overview

Agent Hub MCP is a Model Context Protocol (MCP) server that enables communication and coordination between multiple Claude Code agents working across different repositories in a multi-service architecture.

### Core Components
- **Message Broker**: Inter-agent communication with priority levels and threading
- **Context Store**: Shared key-value store with TTL and namespacing
- **Task Coordination**: Dependency tracking and status management
- **File-based Persistence**: All data stored in `.agent-hub` directory

### Transport Options

**stdio Transport (Primary)**:
- Process-based communication via stdin/stdout
- Direct integration with Claude Code MCP client
- Manual registration required
- Best for local development and production

**HTTP Transport (Special Cases)**:
- RESTful API with Server-Sent Events
- Better for remote access and debugging
- Session management with auto-discovery
- Start with `pnpm run dev` (port 3737)

### Storage Structure
```
.agent-hub/
├── messages/           # Persisted messages by agent
├── context/            # Shared context store
├── agents/             # Agent registrations
└── features/           # Feature collaboration data
```

## Core Concepts

### Message Types
- `context` - Shared information and updates
- `task` - Work assignments and coordination
- `question` - Information requests
- `completion` - Task completion notifications
- `error` - Error reporting and handling
- `sync_request` - Synchronous request/response

### Context Sharing Strategies
- **Namespacing**: Organize by feature/domain (`api`, `ui`, `database`)
- **TTL Support**: Auto-expire temporary context (default: permanent)
- **Versioning**: Conflict resolution for concurrent updates

### Feature-Based Collaboration System
- **Features**: Multi-agent projects that span repositories (e.g., "user-authentication")
- **Tasks**: Major work items within features, broken into agent delegations
- **Delegations**: Specific scopes assigned to individual agents
- **Subtasks**: Implementation work created and managed by domain agents
- **Priority Levels**: `critical`, `high`, `normal`, `low` at feature level
- **Status Tracking**: Multi-level status from features → tasks → delegations → subtasks
- **Context Sharing**: Agents share outputs and progress within feature boundaries

### Agent Lifecycle & Identity

#### Registration Behavior
1. **Clean Agent IDs**: No random suffixes - agents get predictable IDs (user-provided or project name)
2. **Project Path Identity**: Agents are uniquely identified by their project path
3. **Automatic Reconnection**: Same project path reconnects to existing agent, preserving all data
4. **ID Conflict Prevention**: Can't register existing agent ID with different project path

#### Registration Scenarios
- **New Agent**: Fresh project path → Creates new agent with clean ID
- **Reconnection**: Same project path → Reconnects to existing agent ("Welcome back")
- **ID Conflict**: Existing ID + different path → Registration rejected with clear error
- **Path Priority**: Different ID + same path → Reconnects to existing agent by path

#### Lifecycle Stages
1. Registration/reconnection with validation
2. Capability detection and declaration
3. Message handling and context updates
4. Task coordination and dependency management
5. Persistent data across sessions

## MCP Tools Reference

### Communication & Sync
- `send_message(from, to, type, content, [priority], [threadId], [metadata])` - Send message to agent(s)
- `get_messages(agent, [since], [type], [markAsRead])` - Retrieve messages for agent
### Agent Coordination
- `register_agent(id, projectPath, role, [capabilities], [collaboratesWith])` - Register/reconnect agent
  - Validates for ID conflicts (can't use existing ID with different project path)
  - Reconnects if same project path is used (preserves messages and context)
  - Returns error if agent ID is already registered with different path
- `get_hub_status()` - Get overview of hub activity, agents, and collaboration opportunities

### Feature System Tools
- `create_feature(name, title, description, priority, [estimatedAgents], createdBy)` - Create new multi-agent feature
- `create_task(featureId, title, description, delegations[], createdBy)` - Create task with agent delegations
- `create_subtask(featureId, delegationId, subtasks[], createdBy)` - Create implementation subtasks
- `get_agent_workload(agentId)` - Get all work assigned to agent across features
- `get_features([status], [priority], [agent], [createdBy])` - List features with filtering
- `get_feature(featureId)` - Get complete feature data including tasks and delegations
- `accept_delegation(featureId, delegationId, agentId)` - Accept work assigned to agent
- `update_subtask(featureId, subtaskId, [status], [output], [blockedReason], updatedBy)` - Update subtask progress

## Development Guide

### Local Setup
1. **Prerequisites**: Node.js 18+, pnpm
2. **Environment**: Set `AGENT_HUB_DATA_DIR` for custom storage location
3. **Development**: Use `tsx` for TypeScript execution without build step
4. **Testing**: Run `pnpm test` for full test suite with coverage

### Project Structure
```
src/
├── agents/          # Agent lifecycle management
├── messaging/       # Inter-agent communication
├── features/        # Multi-agent collaboration system
├── servers/         # Transport implementations (stdio/HTTP)
├── tools/           # MCP tool definitions & handlers
├── storage/         # File-based and indexed persistence
├── validation/      # Input validation and security
└── types.ts         # TypeScript interfaces
```

### Testing Strategies
- **Unit Tests**: Service layer testing with mocks
- **Integration Tests**: File system storage validation
- **Multi-Agent Tests**: Cross-agent communication scenarios
- **Coverage**: Aim for >90% coverage on core services

### Debugging Techniques
- **HTTP Mode**: Use `pnpm run dev` for browser debugging tools
- **File System**: Check `.agent-hub/` directory for persisted state
- **Logs**: Enable debug logging with `DEBUG=agent-hub:*`
- **Network**: Monitor SSE connections in browser dev tools

### Performance Considerations
- **File Operations**: All storage operations are synchronous for consistency
- **Memory Usage**: IndexedStorage keeps frequently accessed data in memory with file backup
- **Concurrency**: File-based locks prevent corruption but may cause delays
- **Cleanup**: Old messages auto-expire based on agent activity

## Troubleshooting

### Common Issues

**1. MCP Schema Caching**
- **Problem**: Claude Code caches tool schemas, doesn't see changes
- **Solution**: Restart Claude Code completely after schema updates

**2. resources/list_changed Notification**
- **Problem**: Claude Code doesn't refresh resource list automatically
- **Solution**: Manually restart Claude Code to see new resources

**3. Optional Tool Parameters**
- **Problem**: Claude Code validates optional fields as required
- **Solution**: Provide all fields even if marked optional in schema

**4. Agent Registration Issues**
- **Problem**: `agent: null` sessions appear in HTTP mode
- **Solution**: This is normal until `register_agent` is called

**5. Agent ID Conflict Error**
- **Problem**: "Agent ID 'X' is already registered with a different project path"
- **Solution**: This prevents data corruption. Either:
  - Use a different agent ID for the new project
  - Or work from the original project path to reconnect
- **Example**: Can't use ID "backend" for both `/project-a` and `/project-b`

**6. Agent Reconnection vs New Registration**
- **Reconnection**: Same project path → Preserves all messages and context
- **New Registration**: Different project path → Creates fresh agent
- **Best Practice**: Use consistent project paths for reliable agent identity

**7. File Permission Errors**
- **Problem**: Cannot write to `.agent-hub` directory
- **Solution**: Ensure write permissions on parent directory

### Configuration Problems

**stdio Transport Not Working**:
- Verify `dist/index.js` exists (run `pnpm run build`)
- Check file paths are absolute in Claude Code settings
- Ensure `AGENT_HUB_DATA_DIR` environment variable is set

**HTTP Transport Connection Issues**:
- Confirm server is running on port 3737
- Check firewall settings for localhost access
- Verify CORS configuration for browser clients

### Integration Challenges

**Multi-Agent Message Delivery**:
- Messages persist to disk immediately for reliability
- Check `.agent-hub/messages/` for delivery confirmation
- Use comprehensive sync to check all collaboration state

**Context Synchronization**:
- Context updates are atomic and immediately persisted
- TTL expiration happens on read, not write
- Check `.agent-hub/context/` for current state

### Performance Issues

**High File I/O**:
- Monitor `.agent-hub` directory size growth
- Implement cleanup routines for old messages
- Consider database backend for high-volume scenarios

**Memory Usage**:
- Context store loads all data into memory on startup
- Large context values may cause memory pressure
- Use TTL for temporary context to prevent accumulation

## Implementation Notes

### Current Status: PRODUCTION READY
- ✅ Core messaging, context, and task coordination
- ✅ stdio and HTTP transport implementations
- ✅ File-based persistence with security validation
- ✅ Comprehensive test suite (>90% coverage)
- ✅ TypeScript type safety throughout

### Current Limitations
- **File-based Storage**: No atomic transactions across multiple files
- **Concurrent Access**: File locking may cause delays under high load
- **Query Capabilities**: Limited compared to structured databases
- **Memory Scaling**: All context data loaded into memory

### Known Integration Issues
- Claude Code MCP schema caching requires manual restarts
- Resource list notifications not properly handled by Claude Code
- Optional parameter validation inconsistencies

### Future Roadmap
- [ ] Web dashboard for monitoring active agents
- [ ] CLI for manual interaction and debugging
- [ ] Database backend option for high-volume scenarios
- [ ] Enhanced streaming and notification mechanisms
- [ ] Authentication and authorization system

## Configuration Reference

### Agent Configuration (`.agent-hub.json`)
Optional file in agent's project directory:
```json
{
  "agent": "backend-api",
  "role": "API and database operations",
  "capabilities": ["api-design", "database-schema", "testing"],
  "collaborates_with": ["frontend-ui", "mobile-app"]
}
```

### Environment Variables
- `AGENT_HUB_DATA_DIR`: Custom storage location (default: `./.agent-hub`)
- `AGENT_HUB_PORT`: HTTP server port (default: 3737)
- `DEBUG`: Enable debug logging (`DEBUG=agent-hub:*`)

### Transport Selection Guide

**Use stdio Transport When**:
- Local development with single machine
- Production deployments with process management
- Maximum performance and minimal overhead
- Direct MCP client integration

**Use HTTP Transport When**:
- Remote agent coordination needed
- Browser-based debugging required
- Multiple agents on different machines
- RESTful API access needed

For detailed HTTP setup, see [HTTP-CONFIG.md](./docs/HTTP-CONFIG.md).

## Documentation

Additional documentation is available in the `docs/` directory:

- **[SYSTEM-OVERVIEW.md](./docs/SYSTEM-OVERVIEW.md)** - Detailed architecture and design patterns
- **[PRD.md](./docs/PRD.md)** - Product requirements and vision for the Agent Hub
- **[LIMITATIONS.md](./docs/LIMITATIONS.md)** - Current constraints and scaling considerations
- **[KNOWN-ISSUES.md](./docs/KNOWN-ISSUES.md)** - Common problems and their workarounds
- **[HTTP-CONFIG.md](./docs/HTTP-CONFIG.md)** - Detailed HTTP transport configuration

## Development Best Practices

This section documents patterns and practices learned from real debugging and improvement sessions to help maintain code quality and avoid common pitfalls.

### Code Quality & Architecture Patterns

#### Incremental Development
- **One Change at a Time**: Make single, focused changes and test immediately
- **Test After Each Fix**: Run tests after every significant change to catch regressions early
- **Build Verification**: Run `pnpm run build` to ensure TypeScript compilation succeeds
- **Avoid Batch Changes**: Don't combine multiple unrelated fixes in a single change

#### Validation Centralization
- **Single Source of Truth**: Use centralized tool definitions (avoid duplicating schemas)
- **Consistent Application**: Apply validation at all entry points (stdio, HTTP, etc.)
- **Schema Evolution**: Add optional parameters to maintain backward compatibility
```typescript
// Good: Centralized validation
import { validateToolInput } from './validation';
const validatedArgs = validateToolInput(name, arguments_);

// Bad: Inline validation duplicated across handlers
if (!arguments_.from || typeof arguments_.from !== 'string') { ... }
```

#### Error Handling Strategies
- **Graceful Degradation**: Operations should continue even if non-critical parts fail
- **Atomic Operations**: Use `Promise.allSettled()` for batch operations with fault tolerance
- **Defensive Programming**: Check for method availability before calling (e.g., `typeof obj.catch === 'function'`)
- **Idempotent Operations**: Make operations safe to retry (e.g., only update if not already processed)
```typescript
// Good: Graceful error handling
const promises = items.map(item => 
  processItem(item).catch(error => {
    console.error(`Failed to process ${item.id}:`, error);
    return null;
  })
);
await Promise.allSettled(promises);

// Bad: One failure breaks everything
await Promise.all(items.map(processItem));
```

#### Memory Management
- **Timer Cleanup**: Always store timer references and clear them in disposal methods
- **Resource Disposal**: Provide cleanup methods for classes that create background resources
- **Reference Management**: Avoid circular references that prevent garbage collection
```typescript
class ServiceClass {
  private timer: NodeJS.Timeout | null = null;
  
  constructor() {
    this.timer = setInterval(() => this.cleanup(), 60000);
  }
  
  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```

### Testing Patterns & Best Practices

#### Mock Setup Patterns
- **Consistent Mock Structure**: Create complete mock objects that match real interfaces
- **Promise Return Values**: Ensure async mocks return proper Promises
- **Method Availability**: Mock all methods that might be called, even if returning undefined
```typescript
// Good: Complete mock setup
const mockStorage = {
  saveMessage: vi.fn().mockResolvedValue(undefined),
  getMessages: vi.fn().mockResolvedValue([]),
  markMessageAsRead: vi.fn().mockResolvedValue(undefined),
  getMessage: vi.fn().mockResolvedValue(undefined),
};

// Bad: Incomplete mock causing runtime errors
const mockStorage = {
  getMessages: vi.fn(), // No return value, causes .catch() errors
};
```

#### Defensive Testing
- **Handle Mock Limitations**: Check if methods exist before calling (defensive coding)
- **Fallback Behaviors**: Test both optimized and fallback code paths
- **Edge Case Coverage**: Test with empty arrays, null values, and undefined returns
```typescript
// Defensive promise handling for mocks
const markPromise = this.storage.markMessageAsRead(message.id);
if (markPromise && typeof markPromise.catch === 'function') {
  return markPromise.catch(error => { /* handle */ });
}
return Promise.resolve(); // Fallback for incomplete mocks
```

#### Error Simulation Testing
- **Systematic Error Testing**: Test both success and failure scenarios for each operation
- **Partial Failure Testing**: Test scenarios where some operations succeed and others fail
- **Recovery Testing**: Verify systems can recover from error conditions
```typescript
it('should handle mark as read failures gracefully', async () => {
  mockStorage.markMessageAsRead.mockRejectedValue(new Error('Failure'));
  
  // Should not throw, but handle gracefully
  const result = await messageService.getMessages('agent2');
  expect(result.messages[0].read).toBe(false); // Stays unread due to failure
});
```

#### Test Organization
- **Mirror Source Structure**: Tests in `test/` should mirror `src/` directory structure  
- **Descriptive Names**: Use "should [expected behavior] when [condition]" pattern
- **Setup/Teardown**: Use `beforeEach/afterEach` consistently for clean test state
- **Mock Lifecycle**: Clear mocks after each test to prevent cross-test contamination

#### Async Testing Best Practices
- **Proper awaiting**: Always await async operations in tests
- **Timer mocking**: Use `vi.useFakeTimers()` for time-dependent tests
- **Race condition testing**: Test concurrent operations and their interactions
- **Timeout handling**: Set appropriate timeouts for async operations

### Performance Optimization Strategies

#### Pagination Implementation
- **Backward Compatibility**: Add optional parameters that don't break existing calls
- **Progressive Enhancement**: Optimize when parameters are provided, fallback otherwise
- **Interface Evolution**: Extend existing interfaces rather than creating new ones
```typescript
// Good: Extends existing interface
interface MessageFilter {
  agent?: string;
  since?: number; 
  type?: string;
  // New optional parameters
  limit?: number;
  offset?: number;
}

// Implementation handles both cases
if (filter?.limit) {
  // Use pagination
} else {
  // Original behavior
}
```

#### File Operations Optimization
- **Graceful Fallbacks**: Provide fallback when optimization fails (e.g., in tests)
- **Performance vs Reliability**: Prioritize reliability over optimization
- **Error Recovery**: Handle stat failures without breaking core functionality
```typescript
// Try optimization, fall back to original behavior
try {
  const sortedFiles = await sortFilesByModificationTime(files);
  if (sortedFiles.length > 0) {
    return processFiles(sortedFiles);
  }
} catch {
  // Fall back to original order if optimization fails
}
return processFiles(files);
```

#### Caching Strategies
- **Index Utilization**: Use indexes for simple queries, fall back to storage for complex ones
- **Cache Invalidation**: Implement proper cache invalidation strategies
- **Memory Limits**: Set and enforce cache size limits to prevent memory exhaustion

### Security Implementation Patterns

#### Input Validation
- **Centralized Validation**: Apply validation consistently across all entry points
- **Schema-Based**: Use JSON schema validation for consistency and completeness
- **Path Traversal Prevention**: Validate all file paths to prevent directory traversal
```typescript
// Apply validation consistently
const validatedArgs = validateToolInput(name, arguments_);
// Use validated args throughout the handler
const message = createMessage(validatedArgs.from, validatedArgs.to);
```

#### CORS Configuration
- **Explicit Whitelisting**: Use explicit allowed origins rather than regex patterns
- **Environment Configuration**: Allow additional origins via environment variables
- **Minimal Permissions**: Only allow necessary origins, avoid wildcards
```typescript
// Good: Explicit whitelist
const allowedOrigins = [
  'http://localhost:3000',
  'https://claude.ai',
];

// Bad: Overly permissive regex  
/^https:\/\/.*\.claude\.ai$/  // Allows any subdomain
```

#### Error Information Security
- **Internal Error Masking**: Don't expose internal error details to clients
- **Structured Error Responses**: Use consistent error response formats
- **Logging vs Response**: Log detailed errors internally, return sanitized messages

### Common Pitfalls & Solutions

#### Promise Handling Issues
- **Mock Promise Returns**: Ensure mocks return actual Promises, not undefined
- **Chaining Validation**: Check method existence before chaining `.catch()` or `.then()`
- **Error Propagation**: Decide whether to propagate or handle errors gracefully

#### Breaking Changes Prevention
- **Optional Parameters**: Always add new parameters as optional to maintain compatibility
- **Default Behaviors**: Preserve original behavior when new parameters aren't provided
- **Interface Extensions**: Extend existing interfaces rather than modifying them

#### Race Condition Prevention
- **Atomic Operations**: Make read-modify-write operations atomic where possible
- **Batch Processing**: Process related operations together to maintain consistency
- **Idempotent Design**: Make operations safe to retry or call multiple times

#### Memory Leak Prevention
- **Timer References**: Always store and clear timer references
- **Event Listeners**: Remove event listeners in cleanup methods
- **Resource Disposal**: Provide explicit disposal methods for resource-heavy classes

### Development Workflow

#### Fix Implementation Process
1. **Identify Issue**: Clearly understand the problem and its scope
2. **Plan Fix**: Design the solution before implementing
3. **Single Change**: Make one focused change at a time
4. **Test Immediately**: Run relevant tests after each change
5. **Verify Build**: Ensure TypeScript compilation succeeds
6. **Full Test Suite**: Run complete test suite before committing

#### Test-Driven Improvements
- **Test Expectation Updates**: Update tests to match improved behavior
- **Backward Compatibility**: Ensure changes don't break existing functionality
- **Error Behavior**: Document and test new error handling behavior
- **Performance Validation**: Verify optimizations actually improve performance

#### Documentation Maintenance
- **Schema Updates**: Update tool definitions when adding optional parameters  
- **Interface Documentation**: Document new fields and their purposes
- **Breaking Changes**: Clearly document any breaking changes and migration paths
- **Example Updates**: Update code examples to reflect current best practices

### Code Review Guidelines

When reviewing code changes, focus on:

1. **Security**: Input validation, CORS configuration, path traversal prevention
2. **Performance**: Pagination support, caching strategies, resource management
3. **Reliability**: Error handling, race condition prevention, memory management
4. **Testing**: Coverage of new functionality, error scenarios, edge cases
5. **Compatibility**: Backward compatibility, interface stability, migration paths

Following these patterns ensures maintainable, secure, and performant code that can evolve without breaking existing functionality.
