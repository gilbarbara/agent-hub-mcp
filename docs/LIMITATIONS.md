# Agent Hub MCP Limitations

## Overview
This document analyzes the fundamental limitations of Agent Hub MCP when used with Claude Code, current architecture constraints, and comprehensive research into notification approaches that were tested but cannot overcome Claude Code's pull-only model.

## Current Implementation (August 2025)

After extensive testing, the implementation has been **simplified and streamlined** to focus on what actually works with Claude Code's architectural constraints.

### Production Ready Components

**✅ Core System:**
- HTTP MCP Server (`src/servers/http.ts`) - Main server
- Session Management (`src/agents/session.ts`) - Handles null agents until registration  
- Manual Registration (`register_agent` tool) - Project-based ID generation
- Basic MCP Notifications (`src/servers/notifications.ts`) - Limited by Claude Code
- File Storage (`src/storage.ts`) - JSON persistence in `.agent-hub`

**❌ Removed Experimental Components:**
- HeartbeatService - Agent liveness monitoring (unnecessary)
- Auto-registration on connection - Caused orphaned session files
- NotificationBridge/Webhook system - Unused experimental features  
- Agent elicitation/approval system - Over-engineered

### What Actually Works
1. **Agent Registration** - Project-based IDs (e.g., `helpers-x3k2m`)
2. **Message Storage** - Instant server-side storage
3. **Message Retrieval** - Pull-based via get_messages tool
4. **Shared Context** - Cross-agent state management
5. **Task Coordination** - Basic task tracking
6. **File Persistence** - All data survives restarts

### What Doesn't Work (Claude Code Limitations)
1. **MCP Notifications** - `resources/list_changed` sent but ignored
   - *User Impact*: New resources don't appear automatically; requires restart
2. **Automatic Processing** - Agents still need manual checking
   - *User Impact*: Must manually ask agents to check for messages or use `/hub:sync`
3. **Background Awareness** - No interrupt-driven reactions
   - *User Impact*: No real-time collaboration; agents work independently until prompted

## MCP Protocol Implementation Details

### JSON-RPC 2.0 Compliance
Agent Hub MCP implements the full [Model Context Protocol](https://modelcontextprotocol.io/) specification:

- **Transport Layer**: HTTP and stdio transport options
- **Protocol**: JSON-RPC 2.0 request/response pattern
- **Message Types**: `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`
- **Notifications**: `resources/list_changed`, `tools/list_changed` (sent but ignored by Claude Code)

### Tool Schema Validation
All MCP tools are defined with JSON Schema validation:

```json
// Example: send_message tool schema
{
  "name": "send_message",
  "description": "Send a message to another agent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "from": { "type": "string", "description": "Source agent ID" },
      "to": { "type": "string", "description": "Target agent ID" },
      "content": { "type": "string", "description": "Message content" }
    },
    "required": ["from", "to", "content"]
  }
}
```

### Error Handling
- **JSON-RPC Errors**: Standard error codes (-32700 to -32099)
- **Application Errors**: Custom error codes for Agent Hub specific issues
- **Validation Errors**: Schema validation failures with detailed messages
- **Storage Errors**: File system operation failures with retry logic

### Transport Selection
- **stdio**: Direct process communication, fastest, used in production
- **HTTP**: RESTful API with optional SSE, used for debugging/development
- **Configuration**: Transport selected via Claude Code MCP server config

## Problem Statement
The fundamental challenge: **Claude Code agents require manual intervention to check for incoming messages** because Claude Code uses a pull-only model. 

### User Impact:
- **No Real-Time Collaboration**: Agents can't automatically respond to each other's messages
- **Manual Coordination Required**: Must explicitly ask agents to check for messages using `/hub:sync`
- **Delayed Communication**: Messages are stored instantly but agents don't know about them until prompted
- **Workflow Interruption**: Natural collaboration flow is broken by need for manual checking

## Research & Approaches Tested

### 1. HTTP vs SSE Transport Comparison

#### HTTP Transport with MCP SSE
**What we built:**
- Standard HTTP MCP server on port 3737
- Built-in SSE support via MCP protocol
- Standard MCP notifications

**Result:** ❌ **Agents still require manual checking**

#### Pure SSE Transport MCP Server  
**What we tested:**
- Complete MCP server using SSE transport protocol
- Single endpoint where entire MCP protocol runs over SSE
- Followed MCP specification for SSE transport

**Result:** ❌ **Identical behavior - manual checking still required**

**Key Finding:** Transport protocol (HTTP vs SSE) doesn't affect Claude Code's notification processing behavior.

### 2. Claude Code Hooks Research

#### Available Hook Types (2025)
- `PreToolUse` - before tool execution
- `PostToolUse` - after tool execution  
- `Notification` - when Claude sends notifications
- `Stop` - when Claude finishes responses
- `PostAllResponses` - (proposed) after every response

#### Hook Limitations
- ✅ **Outbound-focused** - monitor Claude's own actions
- ❌ **No inbound message hooks** - can't trigger on incoming MCP messages
- ❌ **No MCP message monitoring** - hooks don't watch message queues
- ❌ **No automatic processing** - require manual triggers

**Key Finding:** Hooks are designed for Claude's output, not for processing incoming messages from other agents.

### 3. Hybrid Notification System Implementation

#### Components Built
1. **WebhookNotificationService** - Sends notifications to registered webhooks
2. **NotificationBridge** - Monitors message queues and triggers notifications  
3. **NotificationPreferencesService** - Manages per-agent notification settings
4. **Hook Integration Scripts** - Claude Code hooks that check for messages
5. **Test Infrastructure** - Complete testing and configuration tools

#### Architecture
```
Message Sent → Storage (instant) → Agent Hub MCP Server
                                        ↓
Agent ← Manual Query ← get_messages tool ← File Storage
      ↖ Terminal/System Notification ← Webhook ← Notification Bridge (5s polling)
```

## Critical Findings

### Transport Protocol Analysis
After testing both HTTP and SSE transports extensively:

**✅ What Works:**
- Real-time message storage infrastructure
- Message persistence happens instantly
- MCP protocol compliance maintained
- Message queues updated immediately

**❌ What Doesn't Work:**
- Automatic message delivery to Claude Code
- Background monitoring of incoming messages
- Push-based notification handling
- Autonomous agent reactions

### Claude Code Architecture: Pull-Only Model

#### How Messages Actually Flow:
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Agent A   │    │ Agent Hub   │    │   Agent B   │
│             │    │    MCP      │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
        │                   │                   │
        │ send_message()    │                   │
        │ ─────────────────>│                   │
        │                   │ [stores to file]  │
        │                   │                   │
        │                   │    get_messages() │
        │                   │ <───────────────  │
        │                   │                   │
        │                   │ [reads from file] │
        │                   │ ─────────────────>│
```

#### What This Means:
- **No Push Notifications**: Claude Code never receives automatic notifications
- **Request/Response Only**: All communication initiated by agent tool calls
- **Manual Polling Required**: Agents must explicitly call `get_messages` to check for new messages
- **Storage vs Delivery**: Messages are stored instantly but never automatically delivered

### Claude Code Architecture Limitations

#### Request/Response Lifecycle
Claude Code agents operate on a **human-in-the-loop** pattern:
1. User provides input
2. Agent processes and responds  
3. Agent waits for next user input
4. **No background processing** between interactions
5. **All MCP communication is pull-based** - no push notifications processed

#### MCP Integration Pattern
```
┌─────────────────┐         ┌─────────────────┐
│  Claude Code    │  HTTP   │   MCP Server    │
│     Agent       │ Request │   (Agent Hub)   │
│                 │ ──────> │                 │
│                 │ Response│                 │
│                 │ <────── │                 │
└─────────────────┘         └─────────────────┘
       ↑                             ↑
       │ Manual trigger               │ Storage
       │ (user input)                │ (instant)
┌─────────────────┐         ┌─────────────────┐
│      User       │         │  File System    │
│  (Claude Code)  │         │   (.agent-hub)  │
└─────────────────┘         └─────────────────┘
```

#### Hook System Scope
- Hooks monitor Claude's **outbound actions** (tools, responses)
- **No hooks** for **inbound events** (incoming messages, notifications)
- Background processes run but don't trigger agent processing
- Hooks require **manual triggers** or **scheduled execution**

### The Fundamental Reality

**Real-time storage ≠ Real-time delivery**

- ✅ **Infrastructure works perfectly** - messages stored instantly
- ❌ **Agent awareness fails** - Claude Code never receives messages automatically  
- ✅ **Notifications are sent** - MCP notifications sent but ignored by Claude Code
- ❌ **Agents don't react** - no automatic delivery, only pull-based retrieval

## Experimental Research Findings (Archived)

### Overview
During development, several notification approaches were tested to attempt automatic message delivery. While technically successful, these were removed from the production system because they cannot overcome Claude Code's fundamental pull-only architecture.

### 1. Real-Time Message Storage Infrastructure
**Research Status:** ✅ **Technically Successful** (Now Core Feature)
- Messages stored instantly on server-side file system
- No storage latency or write delays
- Multiple transport options available for queries
- **Outcome:** Integrated into core system as foundational storage layer

### 2. Webhook Notification System  
**Research Status:** ✅ **Proof of Concept Complete** (Removed)
- Webhooks fired immediately when messages were stored
- External systems could receive real-time storage notifications
- Hook scripts could display terminal/system notifications
- **Limitation:** Claude Code agents still required manual prompting to retrieve messages
- **Outcome:** Removed due to complexity without solving core problem

### 3. Notification Bridge
**Research Status:** ✅ **Infrastructure Built** (Removed)
- Monitored message storage every 5 seconds
- Triggered multiple notification channels
- Managed agent preferences and quiet hours
- **Limitation:** No automatic message retrieval possible due to Claude Code's pull-only model
- **Outcome:** Removed as over-engineered solution that didn't address fundamental limitation

## Implementation Details

### Current Production Architecture
```
┌───────────────────────────────┐
│      Agent Hub MCP Server        │
│         (port 3737)              │
│                                  │
│ + HTTP/stdio Transport           │
│ + JSON-RPC 2.0 MCP Protocol      │
│ + File-based Storage             │
│ + Session Management             │
│ + Agent Registration             │
└───────────────────────────────┘
                 │
                 │ File System Storage
                 ↓
┌───────────────────────────────┐
│        .agent-hub/               │
│   ├── messages/                 │
│   ├── context/                  │
│   ├── agents/                   │
│   └── tasks/                    │
└───────────────────────────────┘
```


### API Endpoints

#### Notification System
- `POST /notifications/webhook` - Register/unregister webhooks
- `POST /notifications/test/:agentId` - Test notification delivery
- `GET /notifications/preferences/:agentId` - Get notification preferences
- `POST /notifications/preferences/:agentId` - Update preferences

#### MCP Protocol
- `POST /mcp` - Standard MCP requests (both servers)
- `GET /mcp` - SSE stream establishment

## Practical Recommendations

### For Development Teams
1. **Use the infrastructure** - Real-time delivery works perfectly
2. **Build external monitoring** - Webhooks enable dashboard/CLI tools
3. **Configure notifications** - Terminal/system alerts for awareness
4. **Accept manual checking** - Claude Code's design pattern won't change soon

### For Users
1. **Configure hooks** - Use provided scripts for terminal notifications
2. **Set up system alerts** - macOS/Linux notifications work well  
3. **Use multiple agents** - Real-time coordination between agents works
4. **Monitor with external tools** - Build dashboards that auto-update

### For Future Development
1. **Monitor Claude Code updates** - Watch for automatic notification support
2. **Extend webhook system** - Add more notification channels
3. **Improve hook scripts** - Better integration with OS notification systems
4. **Build monitoring tools** - CLI/web interfaces for real-time status


## Lessons Learned

### Technical
- **Transport doesn't matter** - HTTP vs SSE makes no difference to agent behavior
- **Infrastructure is not the bottleneck** - Claude Code's architecture is the limitation
- **Simplicity wins** - Complex notification systems don't solve the core issue
- **Real-time works** - When agents do check, they get instant responses

### Architectural  
- **Separation of concerns** - Storage vs retrieval are different problems
- **Standards compliance** - MCP protocol handled everything we needed
- **Extensibility** - Storage system is ready for future enhancements
- **Backward compatibility** - All existing functionality preserved

### User Experience
- **Expectations vs reality** - "Real-time" means different things to different systems
- **Manual intervention** - Required by Claude Code's pull-only architecture
- **Polling patterns** - Agents must explicitly check for messages
- **Context switching** - Humans need to manage when agents check messages

## Conclusion

**The hybrid notification system successfully solves the infrastructure problem** - messages are stored instantly and notifications sent through multiple channels. However, **Claude Code's architectural design uses a pull-only model** for message retrieval, which cannot be bypassed through transport or notification improvements.

**What we built is valuable:**
- Real-time storage infrastructure ready for future enhancements
- Multiple notification channels for different use cases  
- Comprehensive testing and configuration tools
- Standards-compliant MCP implementation

**The limitation is architectural:** Claude Code agents use request/response patterns only, not push-based message delivery. This is likely intentional design for safety and predictability.
