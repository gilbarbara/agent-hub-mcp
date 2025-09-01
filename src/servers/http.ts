import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createId } from '@paralleldrive/cuid2';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';

import { AgentStatusCleanup } from '~/agents/cleanup';
import { AgentService } from '~/agents/service';
import { AgentSession, SessionManager } from '~/agents/session';
import { MessageService } from '~/messaging/service';
import { StorageAdapter } from '~/storage';

import { createMcpServer } from './mcp';
import { NotificationService } from './notifications';

export interface HttpServerDependencies {
  agentService: AgentService;
  messageService: MessageService;
  storage: StorageAdapter;
}

export function createHttpServer(deps: HttpServerDependencies): Express {
  const app = express();
  const sessionManager = new SessionManager();
  const notificationService = new NotificationService(sessionManager.getSessions());

  // Start agent status cleanup service
  const agentCleanup = new AgentStatusCleanup(deps.storage);

  agentCleanup.startPeriodicCleanup();

  // Notification system using MCP's built-in notifications
  async function broadcastNotification(method: string, params: any) {
    await notificationService.broadcastNotification(method, params);
  }

  async function sendNotificationToAgent(agentId: string, method: string, params: any) {
    await notificationService.sendNotificationToAgent(agentId, method, params);
  }

  // CORS configuration for browser clients - restricted to localhost
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (Electron apps, Postman, etc.)
        if (!origin) {
          callback(null, true);

          return;
        }

        // Allow only specific localhost ports and official Claude.ai domains
        const defaultAllowedOrigins = [
          // Development servers on common ports
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:8080',
          'http://localhost:5173', // Vite default
          'http://localhost:4173', // Vite preview
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:8080',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:4173',
          // Official Claude.ai domains only
          'https://claude.ai',
          'https://www.claude.ai',
        ];

        // Allow additional origins from environment variable (comma-separated)
        const additionalOrigins =
          process.env.AGENT_HUB_ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || [];
        const allowedOrigins = [...defaultAllowedOrigins, ...additionalOrigins];

        const isAllowed = allowedOrigins.includes(origin);

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      exposedHeaders: ['Mcp-Session-Id'],
      allowedHeaders: ['Content-Type', 'mcp-session-id'],
      credentials: true,
    }),
  );

  app.use(express.json());

  // Rate limiting for DoS protection
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply general rate limiting to all routes
  app.use(generalLimiter);

  // Security headers
  app.use((_, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  // Health check endpoint
  app.get('/ping', (_request, response) => {
    response.json({
      status: 'ok',
      timestamp: Date.now(),
    });
  });

  // MCP HTTP endpoints
  app.post('/mcp', async (request, response) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    let session: AgentSession;

    if (sessionId && sessionManager.has(sessionId)) {
      // Reuse existing session
      session = sessionManager.get(sessionId)!;
    } else if (!sessionId && isInitializeRequest(request.body)) {
      // New initialization request
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => createId(),
        onsessioninitialized: async newSessionId => {
          // eslint-disable-next-line no-console
          console.log(`🔗 New session initialized: ${newSessionId}`);

          // Create temporary session without persistent agent file
          // Agent will be created when they call register_agent
          sessionManager.set(newSessionId, {
            transport,
            agent: null, // No agent until registration
            server,
          });
        },
        enableDnsRebindingProtection: false,
      });

      // Clean up session when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          const closeSession = sessionManager.get(transport.sessionId);

          if (closeSession?.agent) {
            // eslint-disable-next-line no-console
            console.log(`🔌 Session closed: ${transport.sessionId} (${closeSession.agent.id})`);
            sessionManager.delete(transport.sessionId);
            // Broadcast agent left notification
            broadcastNotification('agent_left', { agent: closeSession.agent });
          } else if (closeSession) {
            // eslint-disable-next-line no-console
            console.log(`🔌 Session closed: ${transport.sessionId} (no agent)`);
            sessionManager.delete(transport.sessionId);
          }
        }
      };

      const server = createMcpServer({
        storage: deps.storage,
        messageService: deps.messageService,
        agentService: deps.agentService,
        getCurrentSession: () =>
          transport.sessionId ? sessionManager.get(transport.sessionId) : undefined,
        broadcastNotification,
        sendNotificationToAgent,
        sendResourceNotification: async (agentId: string, uri: string) => {
          await notificationService.sendResourceChangedNotification(agentId, uri);
        },
      });

      await server.connect(transport);

      // This should not happen with proper session initialization
      // No agent created until proper registration
      session = {
        transport,
        agent: null,
        server,
      };
    } else {
      // Invalid request
      response.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });

      return;
    }

    // Handle the request
    await session.transport.handleRequest(request, response, request.body);
  });

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', async (request, response) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessionManager.has(sessionId)) {
      response.status(400).send('Invalid or missing session ID');

      return;
    }

    const session = sessionManager.get(sessionId)!;

    // Update notification service with latest sessions for registered agent
    if (session.agent) {
      notificationService.updateSessions(sessionManager.getSessions());
    }

    await session.transport.handleRequest(request, response);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (request, response) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessionManager.has(sessionId)) {
      response.status(400).send('Invalid or missing session ID');

      return;
    }

    const session = sessionManager.get(sessionId)!;

    await session.transport.handleRequest(request, response);
  });

  return app;
}
