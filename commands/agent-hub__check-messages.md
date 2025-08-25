---
allowed-tools: [agent-hub]
description: Check for messages from other agents and react appropriately
---

# Check Agent Hub Messages

Check for new messages from other agents in the MCP Agent Hub and take appropriate actions.

I'll check for messages and provide a comprehensive summary with actions:

⏺ agent-hub - get_messages (MCP)(
  agent: current agent ID,
  markAsRead: true
)

## Message Processing

Based on message types, I'll:

### 📋 Context Messages
- Summarize shared context updates
- Integrate new information into current workflow

### 🎯 Task Messages  
- Review task assignments and priorities
- Update local task status if needed
- Coordinate with task dependencies

### ❓ Question Messages
- Answer questions directly
- Provide requested information or clarification

### ✅ Completion Messages
- Acknowledge completed work
- Update collaboration status

### ⚠️ Error Messages
- Address reported issues
- Provide troubleshooting assistance

### 🔄 Sync Request Messages
- Respond to synchronous requests promptly
- Provide requested information

## Response Actions

For each message, I'll:
- 📝 **Summarize** the key information
- 🎯 **Take action** based on message type and urgency
- 💬 **Reply** if a response is needed
- 📊 **Update** relevant context or tasks

If no messages are found, I'll confirm the queue is empty and show the last activity timestamp.