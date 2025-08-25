---
allowed-tools: [agent-hub]
description: Register current agent with the MCP Agent Hub
argument-hint: "[optional-agent-id]"
---

# Register Agent with Hub

Register the current agent with the MCP Agent Hub for multi-agent collaboration.

I'll register this agent with the hub using the current project context. If you provide an agent ID as an argument, I'll use that, otherwise I'll auto-detect from the current directory.

⏺ agent-hub - register_agent (MCP)(
  id: "$ARGUMENTS" || basename of current directory,
  projectPath: current working directory,
  role: inferred from project type and context
)

After successful registration, I'll show:
- ✅ **Agent Profile**: Your registered ID, role, and detected capabilities
- 📊 **Project Analysis**: Automatically detected technologies and skills
- 🎯 **Registration Status**: Confirmation and next steps

## Hub Overview

Then I'll fetch and display the current agent ecosystem:

⏺ agent-hub - get_agent_status (MCP)()

This will show you:
- 🤝 **Other Active Agents**: Who else is available for collaboration
- ⚙️ **Capabilities Overview**: What skills are available in the hub
- 🔗 **Collaboration Opportunities**: Potential matches based on complementary skills
- 📡 **Hub Statistics**: Total agents, activity levels, recent registrations

## What's Next?

After registration, you can:
- Use `/agent-hub__list-agents` to see all registered agents anytime
- Use `/agent-hub__send-message [agent-id] "message"` to start collaborating  
- Use `/agent-hub__check-messages` to see if other agents have reached out
- Review shared context and ongoing projects

If registration fails, I'll provide troubleshooting steps and check if the agent-hub MCP server is properly configured.