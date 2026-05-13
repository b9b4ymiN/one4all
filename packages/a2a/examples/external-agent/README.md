# Example External Agent

A working example of an external agent that implements the A2A (Agent-to-Agent) protocol for integration with one4all.

## Overview

This example demonstrates how to create an external agent service that can be discovered and used by one4all through the A2A protocol. It implements all required A2A endpoints and follows the Agent Card standard.

## Features

- **HTTP Server** - Node.js HTTP server on port 3000
- **A2A Endpoints** - Implements all required A2A endpoints
- **API Key Authentication** - Secure authentication via X-API-Key header
- **Agent Card** - Standardized capability advertisement
- **Behavioral Protocols** - Supports request_response, challenge_response, and collaborative modes

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the TypeScript

```bash
npm run build
```

### 3. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`.

### 4. Register with one4all

```bash
one4all a2a register agent-card.yaml
```

### 5. Verify Registration

```bash
one4all a2a list
one4all a2a info example-external-agent
one4all a2a health example-external-agent
```

## Agent Card

The agent is defined in `agent-card.yaml` with the following configuration:

```yaml
id: example-external-agent
name: Example External Agent
role: analyst
domain: example
```

### Capabilities

- **Input Types**: request, challenge
- **Output Types**: response, evidence
- **Interaction Modes**: request_response, challenge_response, collaborative

### Performance

- **Timeout**: 30 seconds
- **Max Tokens**: 4096
- **Max Retries**: 3

## API Endpoints

### GET /health

Health check endpoint (no authentication required).

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-13T20:00:00.000Z",
  "uptime": 123.456,
  "agent": "example-external-agent"
}
```

### GET /agent-card

Returns the agent's card (no authentication required).

```bash
curl http://localhost:3000/agent-card
```

### POST /request

Handle a standard request.

```bash
curl -H "X-API-Key: example-api-key" \
  -X POST http://localhost:3000/request \
  -H "Content-Type: application/json" \
  -d '{"query":"test query"}'
```

Response:
```json
{
  "success": true,
  "agent_id": "example-external-agent",
  "request_id": "req_1234567890_abc123",
  "result": "Processed request: \"test query\"",
  "confidence": 0.95,
  "timestamp": "2026-05-13T20:00:00.000Z"
}
```

### POST /challenge

Handle a challenge request (challenge-response protocol).

```bash
curl -H "X-API-Key: example-api-key" \
  -X POST http://localhost:3000/challenge \
  -H "Content-Type: application/json" \
  -d '{"challenge":"verify this claim"}'
```

Response:
```json
{
  "success": true,
  "agent_id": "example-external-agent",
  "challenge_id": "req_1234567890_abc123",
  "response": "Challenge response for: \"verify this claim\"",
  "evidence": [
    "Evidence point 1 for verify this claim",
    "Evidence point 2 for verify this claim",
    "Analysis completed at 2026-05-13T20:00:00.000Z"
  ],
  "confidence": 0.88,
  "timestamp": "2026-05-13T20:00:00.000Z"
}
```

### POST /evidence

Handle evidence submission.

```bash
curl -H "X-API-Key: example-api-key" \
  -X POST http://localhost:3000/evidence \
  -H "Content-Type: application/json" \
  -d '{"evidence":["fact1","fact2"]}'
```

Response:
```json
{
  "success": true,
  "agent_id": "example-external-agent",
  "evidence_id": "req_1234567890_abc123",
  "result": "Evidence evaluated: [\"fact1\",\"fact2\"]...",
  "confidence": 0.92,
  "timestamp": "2026-05-13T20:00:00.000Z"
}
```

## Authentication

The agent uses API key authentication. Include the API key in the request header:

```bash
X-API-Key: example-api-key
```

Or use Bearer token format:

```bash
Authorization: Bearer example-api-key
```

**Note**: In production, store API keys in environment variables, not in code.

## Configuration

### Port

Default port is 3000. Change by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### API Key

Default API key is `example-api-key`. Change by setting the `API_KEY` environment variable:

```bash
API_KEY=your-secret-key npm start
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Dev Mode (Build + Start)

```bash
npm run dev
```

## Integration with one4all

### Register the Agent

```bash
one4all a2a register agent-card.yaml
```

### Check Agent Status

```bash
# List all agents
one4all a2a list

# Show agent details
one4all a2a info example-external-agent

# Check health
one4all a2a health example-external-agent

# Run trust verification
one4all a2a verify example-external-agent
```

### Unregister the Agent

```bash
one4all a2a unregister example-external-agent
```

## Architecture

```
external-agent/
├── agent-card.yaml    # Agent configuration
├── server.ts          # HTTP server implementation
├── package.json       # NPM package configuration
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

## Next Steps

1. **Customize the Agent** - Modify `agent-card.yaml` to match your agent's capabilities
2. **Implement Business Logic** - Replace the example logic in `server.ts` with your agent's actual processing
3. **Add Tests** - Create tests for your agent's endpoints
4. **Deploy** - Deploy your agent to a server and update the endpoint URL in `agent-card.yaml`
5. **Verify** - Run `one4all a2a verify` to ensure your agent passes trust verification

## Troubleshooting

### Server won't start

Check if port 3000 is already in use:

```bash
lsof -i :3000
```

Or use a different port:

```bash
PORT=3001 npm start
```

### Registration fails

Ensure:
- Agent card YAML is valid
- All required fields are present
- Endpoint URL matches your server address
- one4all CLI is installed

### Authentication errors

Verify the API key matches between your client requests and server configuration:

```bash
curl -H "X-API-Key: example-api-key" http://localhost:3000/health
```

## License

MIT
