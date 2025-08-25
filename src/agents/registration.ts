import { createId } from '@paralleldrive/cuid2';

import { FileStorage } from '../storage.js';
import { AgentRegistration, Message, MessagePriority, MessageType } from '../types.js';

export async function sendWelcomeMessage(
  storage: FileStorage,
  newAgent: AgentRegistration,
): Promise<void> {
  try {
    // Get current collaboration state
    const agents = await storage.getAgents();
    const otherAgents = agents.filter(
      a => a.id !== newAgent.id && Date.now() - a.lastSeen < 5 * 60 * 1000,
    );
    const messages = await storage.getMessages({});
    const unreadMessages = messages.filter(
      m => !m.read && (m.to === newAgent.id || m.to === 'all'),
    );
    const tasks = await storage.getTasks();
    const activeTasks = tasks.filter(t => t.status === 'in-progress');

    // Check if agent is properly registered
    const isProperlyRegistered =
      newAgent.projectPath !== 'unknown' && newAgent.role !== 'Session agent';

    let welcomeContent: string;

    // eslint-disable-next-line unicorn/prefer-ternary
    if (!isProperlyRegistered) {
      // Send registration reminder for unregistered agents
      welcomeContent = `👋 Welcome to Agent Hub MCP!

⚠️ IMPORTANT: Complete your registration to enable collaboration features:

register_agent({
  "id": "your-project-name",
  "projectPath": "/full/path/to/your/project", 
  "role": "Your role (e.g., Frontend Developer)"
})

📋 Quick examples:
• register_agent({"id": "my-react-app", "projectPath": "/Users/name/react-project", "role": "Frontend Developer"})
• register_agent({"id": "api-service", "projectPath": "/Users/name/api-project", "role": "Backend Developer"})

✨ After registration, you'll get:
• Instant notifications
• Project capability detection
• Full collaboration features

${otherAgents.length > 0 ? `\n🤝 ${otherAgents.length} other agent(s) are waiting to collaborate!` : ''}`;
    } else {
      // Send collaboration welcome for properly registered agents
      welcomeContent = `🎉 Welcome ${newAgent.id}! Registration complete.

📊 Your Profile:
• Role: ${newAgent.role}
• Capabilities: ${newAgent.capabilities.length > 0 ? newAgent.capabilities.join(', ') : 'None detected'}
• Project: ${newAgent.projectPath}

${
  otherAgents.length > 0
    ? `🤝 ${otherAgents.length} other agent(s) are active:
${otherAgents.map(a => `  • ${a.id}: ${a.role} ${a.capabilities.length > 0 ? `(${a.capabilities.join(', ')})` : ''}`).join('\n')}`
    : '👋 You are the first properly registered agent!'
}

${unreadMessages.length > 0 ? `📬 You have ${unreadMessages.length} pending message(s)` : ''}

${activeTasks.length > 0 ? `🚀 ${activeTasks.length} active task(s) in progress` : ''}

🔧 Available tools: get_agent_status, send_message, set_context, get_context
📡 Instant notifications are active!`;
    }

    const welcomeMessage: Message = {
      id: createId(),
      from: 'agent-hub',
      to: newAgent.id,
      type: MessageType.CONTEXT,
      content: welcomeContent,
      timestamp: Date.now(),
      read: false,
      priority: isProperlyRegistered ? MessagePriority.NORMAL : MessagePriority.URGENT,
      metadata: {
        type: isProperlyRegistered ? 'collaboration_welcome' : 'registration_reminder',
        registered: isProperlyRegistered,
        otherAgents: otherAgents.map(a => ({
          id: a.id,
          role: a.role,
          capabilities: a.capabilities,
        })),
        pendingMessages: unreadMessages.length,
        activeTasks: activeTasks.length,
      },
    };

    await storage.saveMessage(welcomeMessage);
    // eslint-disable-next-line no-console
    console.log(
      `📬 Sent ${isProperlyRegistered ? 'collaboration welcome' : 'registration reminder'} to ${newAgent.id}`,
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error sending welcome message:', error);
  }
}

export async function updateExistingAgent(
  storage: FileStorage,
  agent: AgentRegistration,
): Promise<AgentRegistration> {
  // Check if agent already exists and update instead of duplicating
  const existingAgents = await storage.getAgents();
  const existingAgent = existingAgents.find(a => a.id === agent.id);

  if (existingAgent) {
    // Update existing agent's lastSeen timestamp
    const updatedAgent = { ...existingAgent, lastSeen: Date.now(), status: 'active' as const };

    await storage.saveAgent(updatedAgent);

    // eslint-disable-next-line no-console
    console.log(`🔄 Updated existing agent: ${agent.id} (${agent.role})`);

    return updatedAgent;
  }

  // Save new agent to storage
  await storage.saveAgent(agent);

  // eslint-disable-next-line no-console
  console.log(`✅ Registered new agent: ${agent.id} (${agent.role})`);

  return agent;
}
