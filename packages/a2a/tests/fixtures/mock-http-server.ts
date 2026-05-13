/**
 * Mock HTTP Server for External Agent Integration Testing
 *
 * This server simulates an external agent that supports the A2A HTTP protocol
 * for testing agent registration, discovery, authentication, rate limiting, and
 * protocol translation.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export interface MockHttpServerConfig {
  port: number;
  requireAuth?: boolean;
  validApiKey?: string;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  responseDelayMs?: number;
  shouldTimeout?: boolean;
}

export class MockHttpServer {
  private server: ReturnType<typeof createServer> | null = null;
  private config: MockHttpServerConfig;
  private requestCount: number = 0;
  private requestTimestamps: number[] = [];

  constructor(config: MockHttpServerConfig) {
    this.config = {
      requireAuth: true,
      validApiKey: 'test-api-key-12345',
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000,
      },
      responseDelayMs: 50,
      shouldTimeout: false,
      ...config,
    };
  }

  /**
   * Start the mock HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.listen(this.config.port, () => {
        console.log(`Mock HTTP server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the mock HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Mock HTTP server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Reset rate limiting counters
   */
  resetRateLimit(): void {
    this.requestCount = 0;
    this.requestTimestamps = [];
  }

  /**
   * Get current request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const { method, url, headers } = req;

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Check rate limiting
    if (!this.checkRateLimit(res)) {
      return;
    }

    // Check authentication
    if (this.config.requireAuth && !this.checkAuth(headers, res)) {
      return;
    }

    // Increment request count
    this.requestCount++;
    this.requestTimestamps.push(Date.now());

    // Simulate timeout if configured
    if (this.config.shouldTimeout) {
      // Don't respond - let the request timeout
      return;
    }

    // Simulate response delay
    setTimeout(() => {
      try {
        const parsedUrl = new URL(url || '', `http://localhost:${this.config.port}`);
        const pathname = parsedUrl.pathname;

        if (pathname === '/health' && method === 'GET') {
          this.handleHealthCheck(res);
        } else if (pathname === '/agent-card' && method === 'GET') {
          this.handleAgentCard(res);
        } else if (pathname === '/register' && method === 'POST') {
          this.handleRegistration(req, res);
        } else if (pathname === '/discover' && method === 'GET') {
          this.handleDiscovery(res);
        } else if (pathname === '/request' && method === 'POST') {
          this.handleRequestEndpoint(req, res);
        } else if (pathname === '/unregister' && method === 'DELETE') {
          this.handleUnregistration(req, res);
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }, this.config.responseDelayMs);
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(res: ServerResponse): boolean {
    if (!this.config.rateLimit) {
      return true;
    }

    const now = Date.now();
    const windowStart = now - this.config.rateLimit.windowMs;

    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    if (this.requestTimestamps.length >= this.config.rateLimit.maxRequests) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Rate limit exceeded',
        limit: this.config.rateLimit.maxRequests,
        windowMs: this.config.rateLimit.windowMs,
      }));
      return false;
    }

    return true;
  }

  /**
   * Check authentication
   */
  private checkAuth(headers: IncomingMessage['headers'], res: ServerResponse): boolean {
    const apiKey = headers['x-api-key'] as string || headers['authorization'] as string;

    if (!apiKey || apiKey !== this.config.validApiKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unauthorized',
        message: 'Valid API key required',
      }));
      return false;
    }

    return true;
  }

  /**
   * Handle health check requests
   */
  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }));
  }

  /**
   * Handle agent card requests
   */
  private handleAgentCard(res: ServerResponse): void {
    const agentCard = {
      id: 'mock-external-agent',
      name: 'Mock External Agent',
      version: '1.0.0',
      domain: 'test',
      active: true,
      role: 'analyst',
      description: 'Mock external agent for testing',
      tags: ['test', 'external', 'mock'],
      capabilities: {
        input_types: ['request', 'challenge'],
        output_types: ['response', 'evidence'],
        skills: [],
        tools_required: [],
        tools_provided: [],
      },
      output_contract: {
        mandatory_fields: ['result', 'confidence'],
        forbidden_content: [],
        validation_rules: [],
      },
      performance: {
        timeout_seconds: 30,
        max_tokens: 8192,
        max_retries: 3,
      },
      a2a_config: {
        endpoint: `http://localhost:${this.config.port}`,
        protocol: 'http',
        authentication: {
          type: 'api_key',
        },
        health_check: {
          enabled: true,
          interval_seconds: 60,
        },
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agentCard));
  }

  /**
   * Handle registration requests
   */
  private handleRegistration(req: IncomingMessage, res: ServerResponse): void {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'registered',
          agent_id: data.id || 'mock-external-agent',
          timestamp: new Date().toISOString(),
        }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }

  /**
   * Handle discovery requests
   */
  private handleDiscovery(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      agents: [
        {
          id: 'mock-external-agent',
          name: 'Mock External Agent',
          status: 'active',
          capabilities: ['request', 'challenge'],
        },
      ],
      total: 1,
    }));
  }

  /**
   * Handle standard request/response
   */
  private handleRequestEndpoint(req: IncomingMessage, res: ServerResponse): void {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const request = JSON.parse(body);

        const response = {
          request_id: request.request_id || `req_${Date.now()}`,
          agent_id: 'mock-external-agent',
          timestamp: new Date().toISOString(),
          status: 'success',
          result: {
            data: 'Mock response from external agent',
            confidence: 0.95,
          },
          metadata: {
            latency_ms: this.config.responseDelayMs,
            protocol: 'http',
          },
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }

  /**
   * Handle unregistration requests
   */
  private handleUnregistration(req: IncomingMessage, res: ServerResponse): void {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'unregistered',
          timestamp: new Date().toISOString(),
        }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return `http://localhost:${this.config.port}`;
  }
}

/**
 * Create and start a mock HTTP server with default configuration
 */
export async function createMockHttpServer(config?: Partial<MockHttpServerConfig>): Promise<MockHttpServer> {
  const server = new MockHttpServer({
    port: 0, // Use random available port
    ...config,
  });

  await server.start();

  return server;
}
