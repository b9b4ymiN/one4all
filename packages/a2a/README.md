# A2A (Agent-to-Agent) Protocol

The A2A protocol enables one4all to integrate external agent services as peers to internal agents, providing a standardized way for agents to discover, communicate, and trust each other.

## Overview

A2A implements the **Senior AI Harness Engineer** principles:
- **Treat the model as unreliable** - Trust verification validates behavior, not self-reported cards
- **Explicit control over clever prompts** - Behavioral protocols with contract enforcement
- **Observable by default** - Gateway events propagate to kernel state machine
- **Verifiable output** - Output contracts, behavioral validation, and chaos engineering tests

## Key Components

### Agent Card Standard

The Agent Card is a standardized format for advertising agent capabilities, compatible with both internal and external agents.

```typescript
interface AgentCard {
  // Identity
  id: string;              // Lowercase with hyphens
  name: string;
  version: string;         // Semver
  domain: string;
  active: boolean;
  role: 'researcher' | 'analyst' | 'synthesizer' | 'validator' | 'executor' | 'monitor' | 'document' | 'coordinator';
  description: string;
  tags: string[];

  // Capability Advertisement
  capabilities: {
    input_types: string[];      // Accepted input schemas
    output_types: string[];     // Produced output schemas
    skills: Skill[];
    tools_required: string[];
    tools_provided: string[];
  };

  // Output Contract
  output_contract: {
    mandatory_fields: string[];   // Required fields in output
    forbidden_content: string[];  // Content that must not appear
    validation_rules: string[];   // Custom validation rules
  };

  // Performance Constraints
  performance: {
    timeout_seconds: number;     // 10-600 seconds
    max_tokens: number;          // 1000-100000
    max_retries: number;         // 0-5
  };

  // A2A Configuration (external agents)
  a2a_config?: {
    endpoint: string;            // HTTP/WebSocket/gRPC endpoint
    protocol: 'http' | 'websocket' | 'grpc';
    authentication: {
      type: 'none' | 'api_key' | 'jwt' | 'oauth2' | 'mutual_tls';
      credentials_ref: string;   // Reference to credentials store
    };
    rate_limits?: {
      max_requests_per_minute: number;
      max_concurrent_requests: number;
    };
    health_check?: {
      enabled: boolean;
      interval_seconds: number;
      endpoint: string;
      timeout_seconds: number;
    };
    behavioral_protocol?: {
      implements_challenge_response: boolean;
      implements_evidence_submission: boolean;
      implements_debate_protocol: boolean;
      supported_interaction_modes: ('request_response' | 'challenge_response' | 'debate' | 'collaborative' | 'adversarial')[];
    };
  };

  // Trust Verification Metadata
  trust?: {
    trust_level: 'unverified' | 'probationary' | 'trusted' | 'certified';
    verification_status: 'pending' | 'in_progress' | 'verified' | 'failed' | 'revoked';
    behavioral_score: number;     // 0-100 from behavioral validation
    probation_expires_at?: string;
  };
}
```

### Trust Levels

| Level | Description | Requirements |
|-------|-------------|--------------|
| **unverified** | Self-attested only | Agent Card only |
| **probationary** | Behavioral validation in progress | Passing initial tests |
| **trusted** | Proven reliability | 7+ days without violations |
| **certified** | Third-party verified | External audit + proven history |

### Behavioral Protocols

A2A supports advanced behavioral protocols for multi-agent interaction:

- **request_response** - Basic request/response
- **challenge_response** - Agent can be challenged and must respond with evidence
- **debate** - Agent participates in structured debates
- **collaborative** - Multi-agent cooperation
- **adversarial** - Agent takes opposing positions

## CLI Usage

### List All Agents

```bash
one4all a2a list
one4all a2a list --all                    # Include inactive agents
one4all a2a list --type external          # Filter by type
one4all a2a list --domain investment      # Filter by domain
```

### Register an Agent

```bash
one4all a2a register agent-card.json
one4all a2a register agent-card.json --source remote
one4all a2a register agent-card.json --force    # Force update if exists
```

### View Agent Details

```bash
one4all a2a info <agent-id>
```

### Check Agent Health

```bash
one4all a2a health <agent-id>
one4all a2a health <agent-id> --verbose
```

### Verify Agent Trust

```bash
one4all a2a verify <agent-id>
one4all a2a verify <agent-id> --full          # Run full verification
one4all a2a verify <agent-id> --update         # Update trust status in registry
```

### Unregister an Agent

```bash
one4all a2a unregister <agent-id>
one4all a2a unregister <agent-id> --force      # Skip confirmation
```

## Agent Card Example

```json
{
  "id": "valuation-agent",
  "name": "DCF Valuation Agent",
  "version": "1.0.0",
  "domain": "investment",
  "active": true,
  "role": "analyst",
  "description": "Performs DCF valuation analysis for publicly traded companies",
  "tags": ["finance", "valuation", "dcf"],
  "capabilities": {
    "input_types": ["ticker", "financials"],
    "output_types": ["valuation", "recommendation"],
    "skills": [
      {
        "id": "dcf-analysis",
        "name": "DCF Analysis",
        "description": "Discounted Cash Flow analysis",
        "version": "1.0"
      }
    ],
    "tools_required": ["market-data"],
    "tools_provided": []
  },
  "output_contract": {
    "mandatory_fields": ["fair_value", "discount_rate", "terminal_value"],
    "forbidden_content": ["error", "exception"],
    "validation_rules": ["fair_value must be positive", "discount_rate must be between 0 and 1"]
  },
  "performance": {
    "timeout_seconds": 120,
    "max_tokens": 8192,
    "max_retries": 3
  },
  "a2a_config": {
    "endpoint": "https://agents.example.com/valuation",
    "protocol": "http",
    "authentication": {
      "type": "api_key",
      "credentials_ref": "valuation-api-key"
    },
    "rate_limits": {
      "max_requests_per_minute": 60,
      "max_concurrent_requests": 5
    },
    "health_check": {
      "enabled": true,
      "interval_seconds": 60,
      "endpoint": "https://agents.example.com/valuation/health",
      "timeout_seconds": 10
    },
    "behavioral_protocol": {
      "implements_challenge_response": true,
      "implements_evidence_submission": true,
      "implements_debate_protocol": false,
      "supported_interaction_modes": ["request_response", "challenge_response", "collaborative"]
    }
  },
  "trust": {
    "trust_level": "probationary",
    "verification_status": "in_progress",
    "behavioral_score": 75,
    "probation_expires_at": "2026-05-20T20:00:00Z"
  }
}
```

## Integration with one4all

### Gateway Integration

The A2A Gateway integrates with the one4all kernel through:

1. **State Machine Events** - Gateway events propagate to kernel state machine
2. **Trust Verification** - Continuous behavioral monitoring with trust level adjustments
3. **Circuit Breaker** - Automatic circuit breaking after 3 failures
4. **Fallback Handling** - Graceful degradation when agents fail

### Gateway States

```
NORMAL → DEGRADED → FALLBACK → CRITICAL
```

- **NORMAL**: All agents operational
- **DEGRADED**: Circuit breaker open or multiple agent failures
- **FALLBACK**: Using fallback agents
- **CRITICAL**: All fallbacks failed, manual intervention required

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Behavioral Validation Tests

```bash
npm run test -- tests/behavioral-validation/
```

### Chaos Engineering Tests

```bash
npm run test -- tests/chaos-engineering/
```

## Troubleshooting

### Agent Registration Fails

**Error**: "Agent trust verification failed"

**Solution**: Check that:
- Agent Card has all required fields
- Behavioral protocol claims match capabilities
- Performance constraints are within valid ranges

### Circuit Breaker Opens

**Error**: "Circuit breaker is open for this agent"

**Solution**: 
1. Wait for cooldown period
2. Agent will automatically enter half-open state
3. Successful requests will close the circuit breaker

### Behavioral Protocol Mismatch

**Error**: "Behavioral validation failed: Behavioral protocol claims not met"

**Solution**: Ensure agent capabilities match behavioral protocol:
- `implements_challenge_response` requires `challenge` in input_types
- `implements_evidence_submission` requires `evidence` in output_types
- `implements_debate_protocol` requires `debate` in input_types

## External Agent Development

### Creating an External Agent

See `/examples/external-agent/` for a complete working example.

### HTTP API Specification

External agents must implement these endpoints:

- `GET /health` - Health check
- `GET /agent-card` - Return agent card
- `POST /request` - Handle request
- `POST /challenge` - Handle challenge/response
- `POST /evidence` - Handle evidence submission
- `POST /debate` - Handle debate protocol

### Authentication

Agents must support the configured authentication type:
- **api_key**: `X-API-Key` or `Authorization` header
- **jwt**: Bearer token in `Authorization` header
- **oauth2**: OAuth2 bearer token

## Security Considerations

1. **Credentials Storage**: Never store actual credentials in Agent Cards. Use `credentials_ref` to reference a secure credentials store.

2. **Sandboxing**: External agents run with `sandbox_level: basic` by default. Adjust based on trust level.

3. **Rate Limiting**: Always configure rate limits for external agents to prevent abuse.

4. **Probationary Period**: New agents enter probation with enhanced monitoring.

## Contributing

When adding new agents to one4all:

1. Create an Agent Card file
2. Run `one4all a2a verify <agent-id>` to validate
3. Run behavioral validation tests
4. Start on probationary trust level
5. Monitor for 7 days before elevating to trusted
