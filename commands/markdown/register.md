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

⏺ agent-hub - get_hub_status (MCP)()

This will show you:
- 🤝 **Other Active Agents**: Who else is available for collaboration
- ⚙️ **Capabilities Overview**: What skills are available in the hub
- 🔗 **Collaboration Opportunities**: Potential matches based on complementary skills
- 📡 **Hub Statistics**: Total agents, activity levels, recent registrations

## What's Next?

After registration, you can:
- Use `/hub:status` to see hub activity, all agents, and collaboration opportunities
- Use `/hub:sync` to get your messages and workload

## Feature-Based Collaboration (Advanced)

After registration, inform the user that the Agent Hub supports **feature-based collaboration** for complex multi-repository projects.

**Explain when features are useful:**
- When work spans multiple projects/repositories requiring coordination
- Example: "Adding a new modality to an AI agent requires changes in the API (backend), UI (frontend), and agent support for modality (livekit agents)"
- Any scenario where multiple agents need to coordinate changes and track dependencies

**How to present the feature system:**
- Features organize complex work into tasks with agent delegations  
- Each agent gets specific scope and creates subtasks for their part
- Agents coordinate by updating progress and sharing context within the feature
- The system provides structure for tracking who's working on what

**When to suggest using features:**
- If the user mentions work that clearly involves multiple repositories
- When coordination with other agents becomes necessary
- Let the user know features can be created when multi-agent coordination is needed

If registration fails, I'll provide troubleshooting steps and check if the agent-hub MCP server is properly configured.
