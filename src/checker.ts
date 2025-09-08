#!/usr/bin/env node

import { execSync } from 'child_process';
import { basename } from 'path';

import type { JsonRpcResponse, MessagesResponse } from './types';

// Agent Hub Message Checker - TypeScript version
// Uses MCP server communication to check for pending messages

function main() {
  try {
    // Get agent ID from current directory name
    const agentId = basename(process.cwd());

    // Prepare JSON-RPC request to get messages without marking as read
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_messages',
        arguments: {
          agent: agentId,
          markAsRead: false,
        },
      },
    });

    // Execute the agent-hub-mcp server with the payload
    const result = execSync(`echo '${payload}' | agent-hub-mcp 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 2000,
    });

    // Parse JSON-RPC response
    const response: JsonRpcResponse = JSON.parse(result);
    const messagesData: MessagesResponse = JSON.parse(response.result.content[0].text);

    // Count unread messages
    const unreadCount = messagesData.messages.filter(message => !message.read).length;

    // Output notification if there are unread messages
    if (unreadCount > 0) {
      const hookOutput = {
        systemMessage: `📬 You have ${unreadCount} unread messages from other agents. Type '/hub:sync' to check.`,
        suppressOutput: true,
      };

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(hookOutput));
    }

    process.exit(0);
  } catch {
    // Fail silently to avoid disrupting Claude Code
    process.exit(0);
  }
}

main();
