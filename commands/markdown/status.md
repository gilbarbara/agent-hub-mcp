---
allowed-tools: [agent-hub]
description: Show hub status with all registered agents and their capabilities
---

# Hub Status

Show current hub status with all registered agents, their roles, capabilities, and collaboration activity.

I'll fetch the current agent registry and provide a comprehensive overview:

⏺ agent-hub - get_hub_status (MCP)()

## Agent Overview

After retrieving the agent list, I'll display:

### 📋 **Active Agents**
For each registered agent, I'll show:
- **🆔 Agent ID**: Unique identifier
- **🎯 Role**: Primary function and specialization  
- **⚙️ Capabilities**: Detected and declared skills
- **📁 Project**: Associated project path
- **🤝 Collaborates With**: Preferred collaboration partners
- **⏰ Last Seen**: Recent activity timestamp
- **📊 Status**: Current activity level

### 📊 **Hub Statistics**
- Total registered agents
- Active vs idle agents
- Most common capabilities
- Recent activity overview

### 🔗 **Collaboration Opportunities**
I'll highlight potential collaboration matches based on:
- Complementary capabilities
- Similar project types
- Declared collaboration preferences

If no agents are registered, I'll provide guidance on getting started with `/hub:register`.
