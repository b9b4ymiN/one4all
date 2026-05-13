/**
 * Example External Agent Server
 *
 * Demonstrates A2A protocol implementation for external agents.
 * This server implements all required A2A endpoints:
 * - GET /health - Health check
 * - GET /agent-card - Return agent card
 * - POST /request - Handle request
 * - POST /challenge - Handle challenge/response
 * - POST /evidence - Handle evidence submission
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// Load agent card
const agentCardPath = join(__dirname, 'agent-card.yaml');
let agentCard: any = null;

try {
  // In production, you'd use a YAML parser. For this example, we return a JSON version.
  agentCard = {
    id: 'example-external-agent',
    name: 'Example External Agent',
    version: '1.0.0',
    domain: 'example',
    active: true,
    role: 'analyst',
    description: 'Example external agent demonstrating A2A protocol implementation',
    tags: ['example', 'external', 'demo'],
    capabilities: {
      input_types: ['request', 'challenge'],
      output_types: ['response', 'evidence'],
      skills: [],
      tools_required: [],
      tools_provided: []
    },
    output_contract: {
      mandatory_fields: ['result', 'confidence'],
      forbidden_content: ['error', 'exception'],
      validation_rules: [
        'confidence must be between 0 and 1',
        'result must be a string'
      ]
    },
    performance: {
      timeout_seconds: 30,
      max_tokens: 4096,
      max_retries: 3
    },
    model: {
      provider: 'example',
      model: 'example-model',
      fallback_providers: [
        { provider: 'example', model: 'fallback-model' }
      ]
    },
    a2a_config: {
      endpoint: `http://localhost:${PORT}`,
      protocol: 'http',
      authentication: {
        type: 'api_key',
        credentials_ref: 'example-api-key'
      },
      rate_limits: {
        max_requests_per_minute: 100,
        max_concurrent_requests: 10
      },
      health_check: {
        enabled: true,
        interval_seconds: 60,
        endpoint: `http://localhost:${PORT}/health`,
        timeout_seconds: 10
      },
      behavioral_protocol: {
        implements_challenge_response: true,
        implements_evidence_submission: true,
        implements_debate_protocol: false,
        supported_interaction_modes: [
          'request_response',
          'challenge_response',
          'collaborative'
        ]
      }
    },
    trust: {
      trust_level: 'unverified',
      verification_status: 'pending',
      verification_method: 'self_attested'
    },
    created_at: new Date().toISOString(),
    owner: 'example'
  };
} catch (err) {
  console.error('Failed to load agent card:', err);
}

// API key for authentication (in production, use environment variables)
const API_KEY = process.env.API_KEY || 'example-api-key';

// Helper to parse JSON body
function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body.length > 0 ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper to verify API key
function verifyApiKey(req: IncomingMessage): boolean {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  if (!apiKey) return false;
  // Support both "X-API-Key: value" and "Authorization: Bearer value" formats
  const key = typeof apiKey === 'string' ? apiKey.replace(/^Bearer\s+/i, '') : apiKey;
  return key === API_KEY;
}

// Helper to send JSON response
function sendJson(res: ServerResponse, data: any, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

// Request handler
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { method, url } = req;

  console.log(`${method} ${url}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    });
    res.end();
    return;
  }

  // Health check endpoint (no auth required)
  if (url === '/health' && method === 'GET') {
    sendJson(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      agent: agentCard?.id
    });
    return;
  }

  // Agent card endpoint (no auth required)
  if (url === '/agent-card' && method === 'GET') {
    sendJson(res, agentCard);
    return;
  }

  // Verify API key for all other endpoints
  if (!verifyApiKey(req)) {
    sendJson(res, {
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    }, 401);
    return;
  }

  // Request endpoint
  if (url === '/request' && method === 'POST') {
    try {
      const body = await parseBody(req);

      // Process the request
      const result = processRequest(body);

      sendJson(res, {
        success: true,
        agent_id: agentCard.id,
        request_id: body.request_id || generateRequestId(),
        result: result.result,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      sendJson(res, {
        success: false,
        error: 'Failed to process request',
        message: err instanceof Error ? err.message : String(err)
      }, 500);
    }
    return;
  }

  // Challenge endpoint
  if (url === '/challenge' && method === 'POST') {
    try {
      const body = await parseBody(req);

      // Process the challenge
      const response = processChallenge(body);

      sendJson(res, {
        success: true,
        agent_id: agentCard.id,
        challenge_id: body.challenge_id || generateRequestId(),
        response: response.response,
        evidence: response.evidence,
        confidence: response.confidence,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      sendJson(res, {
        success: false,
        error: 'Failed to process challenge',
        message: err instanceof Error ? err.message : String(err)
      }, 500);
    }
    return;
  }

  // Evidence endpoint
  if (url === '/evidence' && method === 'POST') {
    try {
      const body = await parseBody(req);

      // Process evidence submission
      const result = processEvidence(body);

      sendJson(res, {
        success: true,
        agent_id: agentCard.id,
        evidence_id: body.evidence_id || generateRequestId(),
        result: result.result,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      sendJson(res, {
        success: false,
        error: 'Failed to process evidence',
        message: err instanceof Error ? err.message : String(err)
      }, 500);
    }
    return;
  }

  // 404 - Not found
  sendJson(res, {
    error: 'Not found',
    message: `Endpoint ${method} ${url} not found`,
    available_endpoints: [
      'GET /health',
      'GET /agent-card',
      'POST /request',
      'POST /challenge',
      'POST /evidence'
    ]
  }, 404);
}

// Request processing logic
function processRequest(input: any): { result: string; confidence: number } {
  // Example: simple echo with analysis
  const query = input.query || input.request || 'hello';

  return {
    result: `Processed request: "${query}"`,
    confidence: 0.95
  };
}

// Challenge processing logic
function processChallenge(input: any): { response: string; evidence: string[]; confidence: number } {
  const challenge = input.challenge || input.query || 'unknown';

  return {
    response: `Challenge response for: "${challenge}"`,
    evidence: [
      `Evidence point 1 for ${challenge}`,
      `Evidence point 2 for ${challenge}`,
      `Analysis completed at ${new Date().toISOString()}`
    ],
    confidence: 0.88
  };
}

// Evidence processing logic
function processEvidence(input: any): { result: string; confidence: number } {
  const evidence = input.evidence || input.data || 'no data';

  return {
    result: `Evidence evaluated: ${JSON.stringify(evidence).substring(0, 100)}...`,
    confidence: 0.92
  };
}

// Generate random request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// Create and start server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Example External Agent running on http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET  /health     - Health check`);
  console.log(`  GET  /agent-card - Get agent card`);
  console.log(`  POST /request    - Handle request`);
  console.log(`  POST /challenge  - Handle challenge`);
  console.log(`  POST /evidence   - Handle evidence`);
  console.log(`\nUse API key: ${API_KEY}`);
  console.log(`\nExample curl commands:`);
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl -H "X-API-Key: ${API_KEY}" -X POST http://localhost:${PORT}/request -d '{"query":"test"}'`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
