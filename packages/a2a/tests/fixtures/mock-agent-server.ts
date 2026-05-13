/**
 * Mock External Agent Server for Behavioral Validation Testing
 *
 * This server simulates an external agent that implements A2A protocol
 * for testing behavioral validation features including:
 * - Response time measurement
 * - Output contract compliance
 * - Behavioral protocol adherence (challenge/response, evidence submission, debate)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';

export interface MockAgentConfig {
  port: number;
  responseDelayMs?: number;
  timeoutAfterMs?: number;
  shouldReturnInvalidOutput?: boolean;
  shouldIncludeForbiddenContent?: boolean;
  implementsChallengeResponse?: boolean;
  implementsEvidenceSubmission?: boolean;
  implementsDebateProtocol?: boolean;
}

export class MockAgentServer {
  private server: ReturnType<typeof createServer> | null = null;
  private config: MockAgentConfig;

  constructor(config: MockAgentConfig) {
    this.config = {
      responseDelayMs: 100,
      timeoutAfterMs: 30000,
      shouldReturnInvalidOutput: false,
      shouldIncludeForbiddenContent: false,
      implementsChallengeResponse: true,
      implementsEvidenceSubmission: true,
      implementsDebateProtocol: true,
      ...config,
    };
  }

  /**
   * Start the mock agent server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.listen(this.config.port, () => {
        console.log(`Mock agent server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the mock agent server
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
          console.log('Mock agent server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const { method, url } = req;

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Simulate response delay
    setTimeout(() => {
      try {
        if (url === '/health' && method === 'GET') {
          this.handleHealthCheck(res);
        } else if (url === '/agent-card' && method === 'GET') {
          this.handleAgentCard(res);
        } else if (url === '/request' && method === 'POST') {
          this.handleRequestEndpoint(req, res);
        } else if (url === '/challenge' && method === 'POST') {
          this.handleChallenge(req, res);
        } else if (url === '/evidence' && method === 'POST') {
          this.handleEvidenceSubmission(req, res);
        } else if (url === '/debate' && method === 'POST') {
          this.handleDebate(req, res);
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
   * Handle health check requests
   */
  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Handle agent card requests
   */
  private handleAgentCard(res: ServerResponse): void {
    const agentCard = {
      id: 'mock-test-agent',
      name: 'Mock Test Agent',
      version: '1.0.0',
      domain: 'test',
      active: true,
      role: 'analyst',
      description: 'Mock agent for behavioral validation testing',
      tags: ['test', 'mock'],
      capabilities: {
        input_types: ['request', 'challenge', 'evidence-request', 'debate'],
        output_types: ['response', 'evidence', 'argument'],
        skills: [],
        tools_required: [],
        tools_provided: [],
      },
      output_contract: {
        mandatory_fields: ['result', 'confidence', 'timestamp'],
        forbidden_content: ['error', 'exception'],
        validation_rules: ['confidence must be between 0 and 1', 'result must be a string'],
      },
      performance: {
        timeout_seconds: 30,
        max_tokens: 8192,
        max_retries: 3,
      },
      a2a_config: {
        endpoint: `http://localhost:${this.config.port}`,
        protocol: 'http',
        behavioral_protocol: {
          implements_challenge_response: this.config.implementsChallengeResponse,
          implements_evidence_submission: this.config.implementsEvidenceSubmission,
          implements_debate_protocol: this.config.implementsDebateProtocol,
          supported_interaction_modes: ['request_response', 'challenge_response', 'debate', 'collaborative', 'adversarial'],
        },
      },
    };

    res.writeHead(200);
    res.end(JSON.stringify(agentCard));
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

        if (this.config.shouldReturnInvalidOutput) {
          // Return output missing mandatory fields
          res.writeHead(200);
          res.end(JSON.stringify({ result: 'incomplete' }));
          return;
        }

        if (this.config.shouldIncludeForbiddenContent) {
          // Return output with forbidden content
          res.writeHead(200);
          res.end(JSON.stringify({
            result: 'An error occurred',
            confidence: 0.5,
            timestamp: new Date().toISOString(),
          }));
          return;
        }

        // Return valid output
        const response = {
          result: 'Analysis complete',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
          agent_id: 'mock-test-agent',
        };

        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }

  /**
   * Handle challenge/response protocol
   */
  private handleChallenge(req: IncomingMessage, res: ServerResponse): void {
    if (!this.config.implementsChallengeResponse) {
      res.writeHead(501);
      res.end(JSON.stringify({ error: 'Challenge/response not implemented' }));
      return;
    }

    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const challenge = JSON.parse(body);

        const response = {
          challenge_id: challenge.challenge_id,
          response: 'Challenge accepted and addressed',
          evidence: ['fact1', 'fact2', 'fact3'],
          confidence: 0.9,
          timestamp: new Date().toISOString(),
        };

        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid challenge' }));
      }
    });
  }

  /**
   * Handle evidence submission
   */
  private handleEvidenceSubmission(req: IncomingMessage, res: ServerResponse): void {
    if (!this.config.implementsEvidenceSubmission) {
      res.writeHead(501);
      res.end(JSON.stringify({ error: 'Evidence submission not implemented' }));
      return;
    }

    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const evidenceReq = JSON.parse(body);

        const response = {
          evidence_id: `ev_${Date.now()}`,
          status: 'accepted',
          evidence: evidenceReq.evidence || [],
          verified: true,
          timestamp: new Date().toISOString(),
        };

        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid evidence request' }));
      }
    });
  }

  /**
   * Handle debate protocol
   */
  private handleDebate(req: IncomingMessage, res: ServerResponse): void {
    if (!this.config.implementsDebateProtocol) {
      res.writeHead(501);
      res.end(JSON.stringify({ error: 'Debate protocol not implemented' }));
      return;
    }

    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const debate = JSON.parse(body);

        const response = {
          debate_id: debate.debate_id || `deb_${Date.now()}`,
          position: 'con',
          argument: 'Counter-argument based on evidence',
          supporting_evidence: ['source1', 'source2'],
          confidence: 0.85,
          timestamp: new Date().toISOString(),
        };

        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid debate request' }));
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
 * Create and start a mock agent server with default configuration
 */
export async function createMockAgent(config?: Partial<MockAgentConfig>): Promise<MockAgentServer> {
  const server = new MockAgentServer({
    port: 0, // Use random available port
    ...config,
  });

  await server.start();

  return server;
}
