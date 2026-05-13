import { describe, it, expect } from 'vitest';
import {
  ExternalAgentAdapter,
  InternalAgentAdapter,
  AgentAdapterFactory,
  BehavioralCompatibilityManager,
} from '../../../src/adapters/agent-adapter.js';
import { InteractionMode } from '../../../src/protocols/behavioral-protocol.js';
import type { AgentCard } from '../../../src/schemas/agent-card.schema.js';
import type { InternalMessage, A2ARequest, A2AResponse } from '../../../src/adapters/agent-adapter.js';

describe('Agent Adapter', () => {
  describe('ExternalAgentAdapter', () => {
    let externalCard: AgentCard;
    let adapter: ExternalAgentAdapter;

    beforeEach(() => {
      externalCard = {
        id: 'external-analyst',
        name: 'External Analyst',
        version: '1.0.0',
        domain: 'investment',
        active: true,
        role: 'analyst',
        description: 'External analyst agent',
        tags: ['external', 'finance'],
        capabilities: {
          input_types: ['stock-analysis'],
          output_types: ['valuation'],
          skills: [],
          tools_required: [],
          tools_provided: [],
        },
        output_contract: {
          mandatory_fields: ['fair_value', 'mos'],
          forbidden_content: [],
          validation_rules: [],
        },
        a2a_config: {
          endpoint: 'https://api.example.com/agent',
          protocol: 'http',
          authentication: {
            type: 'api_key',
            credentials_ref: 'secret:external-analyst-key',
          },
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: true,
            implements_debate_protocol: false,
            supported_interaction_modes: ['request_response', 'challenge_response'],
          },
        },
      };

      adapter = new ExternalAgentAdapter(externalCard);
    });

    describe('adaptRequest', () => {
      it('should adapt internal message to A2A request', () => {
        const message: InternalMessage = {
          id: 'msg-123',
          type: 'analysis-request',
          sender: 'gateway',
          recipient: 'external-analyst',
          timestamp: '2026-05-13T10:00:00Z',
          payload: { symbol: 'AAPL', horizon: '12m' },
          context: { source: 'user_request' },
          timeout: 120,
          reply_to: 'msg-100',
        };

        const request = adapter.adaptRequest(message);

        expect(request).toEqual({
          request_id: 'msg-123',
          timestamp: '2026-05-13T10:00:00Z',
          agent_id: 'external-analyst',
          task: {
            type: 'analysis-request',
            input: { symbol: 'AAPL', horizon: '12m' },
            context: { source: 'user_request' },
          },
          constraints: {
            timeout_seconds: 120,
          },
          reply_to: 'msg-100',
        });
      });

      it('should handle message with minimal fields', () => {
        const message: InternalMessage = {
          id: 'msg-456',
          type: 'simple-request',
          sender: 'system',
          recipient: 'external-analyst',
          timestamp: '2026-05-13T11:00:00Z',
          payload: { data: 'test' },
        };

        const request = adapter.adaptRequest(message);

        expect(request.request_id).toBe('msg-456');
        expect(request.task.input).toEqual({ data: 'test' });
        expect(request.constraints).toEqual({ timeout_seconds: undefined });
      });
    });

    describe('adaptResponse', () => {
      it('should adapt A2A response to internal message', () => {
        const response: A2AResponse = {
          request_id: 'req-123',
          agent_id: 'external-analyst',
          timestamp: '2026-05-13T10:01:00Z',
          status: 'success',
          output: {
            fair_value: 185.50,
            mos: 0.15,
            confidence: 0.85,
          },
          metadata: {
            latency_ms: 850,
            tokens_used: 1250,
          },
        };

        const message = adapter.adaptResponse(response);

        expect(message).toEqual({
          id: 'req-123',
          type: 'response',
          sender: 'external-analyst',
          recipient: 'gateway',
          timestamp: '2026-05-13T10:01:00Z',
          payload: {
            fair_value: 185.50,
            mos: 0.15,
            confidence: 0.85,
          },
          status: 'success',
          metadata: {
            latency_ms: 850,
            tokens_used: 1250,
          },
        });
      });

      it('should adapt error response', () => {
        const response: A2AResponse = {
          request_id: 'req-456',
          agent_id: 'external-analyst',
          timestamp: '2026-05-13T11:01:00Z',
          status: 'error',
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          },
          metadata: { latency_ms: 50 },
        };

        const message = adapter.adaptResponse(response);

        expect(message.status).toBe('error');
        expect(message.error).toEqual({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
        });
      });
    });

    describe('supportsMode', () => {
      it('should return true for supported modes', () => {
        expect(adapter.supportsMode(InteractionMode.REQUEST_RESPONSE)).toBe(true);
        expect(adapter.supportsMode(InteractionMode.CHALLENGE_RESPONSE)).toBe(true);
      });

      it('should return false for unsupported modes', () => {
        expect(adapter.supportsMode(InteractionMode.DEBATE)).toBe(false);
        expect(adapter.supportsMode(InteractionMode.COLLABORATIVE)).toBe(false);
        expect(adapter.supportsMode(InteractionMode.ADVERSARIAL)).toBe(false);
      });
    });

    describe('handleBehavioralRequest', () => {
      it('should accept challenge request when supported', async () => {
        const request = {
          type: 'challenge',
          challenge: {
            type: 'assumption',
            content: 'Challenge the assumption',
          },
        };

        await expect(adapter.handleBehavioralRequest(request)).rejects.toThrow(
          'External agent behavioral protocol forwarding not yet implemented'
        );
      });

      it('should reject debate request when not supported', async () => {
        const request = {
          type: 'debate',
          topic: 'Test topic',
        };

        await expect(adapter.handleBehavioralRequest(request)).rejects.toThrow(
          'Agent does not support debate protocol'
        );
      });

      it('should reject any request when no behavioral protocol', async () => {
        const simpleCard: AgentCard = {
          id: 'simple-external',
          name: 'Simple External',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            endpoint: 'https://api.example.com/simple',
          },
        };

        const simpleAdapter = new ExternalAgentAdapter(simpleCard);

        await expect(simpleAdapter.handleBehavioralRequest({ type: 'challenge' })).rejects.toThrow(
          'Agent does not implement behavioral protocol'
        );
      });
    });
  });

  describe('InternalAgentAdapter', () => {
    let internalCard: AgentCard;
    let adapter: InternalAgentAdapter;

    beforeEach(() => {
      internalCard = {
        id: 'internal-analyst',
        name: 'Internal Analyst',
        version: '1.0.0',
        domain: 'investment',
        active: true,
        role: 'analyst',
        description: 'Internal analyst agent',
        tags: ['internal', 'finance'],
        capabilities: {
          input_types: ['stock-analysis'],
          output_types: ['valuation'],
          skills: [{ id: 'valuation', name: 'Valuation', description: 'DCF analysis' }],
          tools_required: ['market-data'],
          tools_provided: [],
        },
        output_contract: {
          mandatory_fields: ['fair_value', 'mos'],
          forbidden_content: ['speculative_language'],
          validation_rules: ['confidence_must_be_defined'],
        },
      };

      adapter = new InternalAgentAdapter(internalCard);
    });

    describe('adaptRequest', () => {
      it('should adapt internal message to A2A request', () => {
        const message: InternalMessage = {
          id: 'msg-789',
          type: 'analysis-request',
          sender: 'gateway',
          recipient: 'internal-analyst',
          timestamp: '2026-05-13T12:00:00Z',
          payload: { symbol: 'MSFT', horizon: '24m' },
          timeout: 180,
        };

        const request = adapter.adaptRequest(message);

        expect(request.request_id).toBe('msg-789');
        expect(request.agent_id).toBe('internal-analyst');
        expect(request.task.type).toBe('analysis-request');
        expect(request.task.input).toEqual({ symbol: 'MSFT', horizon: '24m' });
        expect(request.constraints?.timeout_seconds).toBe(180);
      });
    });

    describe('adaptResponse', () => {
      it('should adapt A2A response to internal message', () => {
        const response: A2AResponse = {
          request_id: 'req-789',
          agent_id: 'internal-analyst',
          timestamp: '2026-05-13T12:02:00Z',
          status: 'success',
          output: {
            fair_value: 450.00,
            mos: 0.20,
            confidence: 0.90,
          },
        };

        const message = adapter.adaptResponse(response);

        expect(message.id).toBe('req-789');
        expect(message.sender).toBe('internal-analyst');
        expect(message.payload).toEqual({
          fair_value: 450.00,
          mos: 0.20,
          confidence: 0.90,
        });
        expect(message.status).toBe('success');
      });
    });

    describe('supportsMode', () => {
      it('should return true for all interaction modes', () => {
        expect(adapter.supportsMode(InteractionMode.REQUEST_RESPONSE)).toBe(true);
        expect(adapter.supportsMode(InteractionMode.CHALLENGE_RESPONSE)).toBe(true);
        expect(adapter.supportsMode(InteractionMode.DEBATE)).toBe(true);
        expect(adapter.supportsMode(InteractionMode.COLLABORATIVE)).toBe(true);
        expect(adapter.supportsMode(InteractionMode.ADVERSARIAL)).toBe(true);
      });
    });

    describe('handleBehavioralRequest', () => {
      it('should accept all behavioral request types', async () => {
        const challengeRequest = { type: 'challenge', data: {} };
        const debateRequest = { type: 'debate', data: {} };
        const evidenceRequest = { type: 'evidence', data: {} };

        await expect(adapter.handleBehavioralRequest(challengeRequest)).rejects.toThrow(
          'Internal agent behavioral protocol integration not yet implemented'
        );
        await expect(adapter.handleBehavioralRequest(debateRequest)).rejects.toThrow(
          'Internal agent behavioral protocol integration not yet implemented'
        );
        await expect(adapter.handleBehavioralRequest(evidenceRequest)).rejects.toThrow(
          'Internal agent behavioral protocol integration not yet implemented'
        );
      });
    });
  });

  describe('AgentAdapterFactory', () => {
    describe('createAdapter', () => {
      it('should create ExternalAgentAdapter for external agent', () => {
        const externalCard: AgentCard = {
          id: 'external',
          name: 'External',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            endpoint: 'https://api.example.com',
          },
        };

        const adapter = AgentAdapterFactory.createAdapter(externalCard);
        expect(adapter).toBeInstanceOf(ExternalAgentAdapter);
      });

      it('should create InternalAgentAdapter for internal agent', () => {
        const internalCard: AgentCard = {
          id: 'internal',
          name: 'Internal',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        };

        const adapter = AgentAdapterFactory.createAdapter(internalCard);
        expect(adapter).toBeInstanceOf(InternalAgentAdapter);
      });
    });

    describe('isExternalAgent', () => {
      it('should return true for agent with endpoint', () => {
        const card: AgentCard = {
          id: 'external',
          name: 'External',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            endpoint: 'https://api.example.com',
          },
        };

        expect(AgentAdapterFactory.isExternalAgent(card)).toBe(true);
      });

      it('should return false for agent without endpoint', () => {
        const card: AgentCard = {
          id: 'internal',
          name: 'Internal',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        };

        expect(AgentAdapterFactory.isExternalAgent(card)).toBe(false);
      });
    });

    describe('isInternalAgent', () => {
      it('should return true for agent without endpoint', () => {
        const card: AgentCard = {
          id: 'internal',
          name: 'Internal',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        };

        expect(AgentAdapterFactory.isInternalAgent(card)).toBe(true);
      });

      it('should return false for agent with endpoint', () => {
        const card: AgentCard = {
          id: 'external',
          name: 'External',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            endpoint: 'https://api.example.com',
          },
        };

        expect(AgentAdapterFactory.isInternalAgent(card)).toBe(false);
      });
    });
  });

  describe('BehavioralCompatibilityManager', () => {
    let manager: BehavioralCompatibilityManager;

    beforeEach(() => {
      manager = new BehavioralCompatibilityManager();
    });

    describe('checkCompatibility', () => {
      it('should return compatible for agent with full behavioral protocol', async () => {
        const card: AgentCard = {
          id: 'fully-compatible',
          name: 'Fully Compatible',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            behavioral_protocol: {
              implements_challenge_response: true,
              implements_evidence_submission: true,
              implements_debate_protocol: true,
              supported_interaction_modes: ['request_response', 'challenge_response', 'debate', 'collaborative'],
            },
          },
        };

        const result = await manager.checkCompatibility(card);

        expect(result.compatible).toBe(true);
        expect(result.reasons).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should return incompatible for agent without behavioral protocol', async () => {
        const card: AgentCard = {
          id: 'no-protocol',
          name: 'No Protocol',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        };

        const result = await manager.checkCompatibility(card);

        expect(result.compatible).toBe(false);
        expect(result.reasons).toContain('Agent does not implement behavioral protocol');
        expect(result.requiredAdaptations).toContain('Wrap with ExternalAgentAdapter');
      });

      it('should warn about limited interaction modes', async () => {
        const card: AgentCard = {
          id: 'limited-modes',
          name: 'Limited Modes',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            behavioral_protocol: {
              implements_challenge_response: true,
              implements_evidence_submission: true,
              implements_debate_protocol: true,
              supported_interaction_modes: ['request_response'],
            },
          },
        };

        const result = await manager.checkCompatibility(card);

        expect(result.compatible).toBe(true);
        expect(result.warnings).toContain('Agent only supports request/response mode');
      });

      it('should provide warnings for missing protocol features', async () => {
        const card: AgentCard = {
          id: 'partial-protocol',
          name: 'Partial Protocol',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            behavioral_protocol: {
              implements_challenge_response: false,
              implements_evidence_submission: false,
              implements_debate_protocol: false,
              supported_interaction_modes: ['request_response'],
            },
          },
        };

        const result = await manager.checkCompatibility(card);

        expect(result.warnings).toContain('Agent cannot handle challenges - may not participate effectively in debates');
        expect(result.warnings).toContain('Agent cannot submit structured evidence');
        expect(result.warnings).toContain('Agent cannot participate in structured debates');
      });
    });

    describe('adaptMessage', () => {
      it('should adapt message between agents', () => {
        const fromCard: AgentCard = {
          id: 'internal',
          name: 'Internal',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        };

        const toCard: AgentCard = {
          id: 'external',
          name: 'External',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            endpoint: 'https://api.example.com',
          },
        };

        const message: InternalMessage = {
          id: 'msg-test',
          type: 'test',
          sender: 'internal',
          recipient: 'external',
          timestamp: '2026-05-13T13:00:00Z',
          payload: { data: 'test' },
        };

        const adapted = manager.adaptMessage(fromCard, toCard, message);

        expect(adapted.recipient).toBe('external');
      });
    });

    describe('handleBehavioralInteraction', () => {
      it('should reject interaction for unsupported mode', async () => {
        const card: AgentCard = {
          id: 'limited',
          name: 'Limited',
          version: '1.0.0',
          domain: 'test',
          active: true,
          role: 'analyst',
          description: 'Test',
          capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
          output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
          a2a_config: {
            behavioral_protocol: {
              implements_challenge_response: false,
              implements_evidence_submission: false,
              implements_debate_protocol: false,
              supported_interaction_modes: ['request_response'],
            },
          },
        };

        await expect(
          manager.handleBehavioralInteraction(card, InteractionMode.DEBATE, {})
        ).rejects.toThrow('Agent limited does not support interaction mode: debate');
      });
    });
  });
});
