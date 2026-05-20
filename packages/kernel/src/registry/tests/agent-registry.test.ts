/**
 * Agent Registry Tests
 *
 * Tests for agent metadata loading and routing functions
 */

import { describe, it, expect } from 'vitest';
import { AgentRegistryLoader } from '../agent-registry.js';
import type { AgentConfig } from '../types.js';

describe('AgentRegistryLoader', () => {
  const loader = new AgentRegistryLoader('/home/dasimoa/one4all');

  describe('getAgentsByExpertise', () => {
    it('should find agents by valuation expertise', async () => {
      const agents = await loader.getAgentsByExpertise('valuation');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some((a: AgentConfig) => a.id === 'damodaran-valuation')).toBe(true);
    });

    it('should find agents by downside expertise', async () => {
      const agents = await loader.getAgentsByExpertise('downside');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some((a: AgentConfig) => a.id === 'seth-klarman')).toBe(true);
    });
  });

  describe('getAgentsByWhenToUse', () => {
    it('should match Thai trigger patterns', async () => {
      const agents = await loader.getAgentsByWhenToUse('ประเมินมูลค่า');

      expect(agents.length).toBeGreaterThan(0);
    });

    it('should match English trigger patterns', async () => {
      const agents = await loader.getAgentsByWhenToUse('worth');

      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentsByModelTier', () => {
    it('should return expert tier agents', async () => {
      const expertAgents = await loader.getAgentsByModelTier('expert');

      expect(expertAgents.length).toBeGreaterThan(0);
      expect(expertAgents.every((a: AgentConfig) => a.routing_metadata?.model_tier === 'expert')).toBe(true);
    });

    it('should return non-expert tier agents', async () => {
      const nonExpertAgents = await loader.getAgentsByModelTier('non_expert');

      expect(nonExpertAgents.length).toBeGreaterThan(0);
      expect(nonExpertAgents.every((a: AgentConfig) => a.routing_metadata?.model_tier === 'non_expert')).toBe(true);
    });
  });

  describe('getDebatePartners', () => {
    it('should find debate partners for damodaran-valuation', async () => {
      const partners = await loader.getDebatePartners('damodaran-valuation');

      expect(partners.length).toBeGreaterThan(0);
      expect(partners.some((p: AgentConfig) => p.id === 'seth-klarman')).toBe(true);
    });
  });

  describe('routeQuestion', () => {
    it('should route Thai valuation question correctly', async () => {
      const result = await loader.routeQuestion('หุ้นนี้มีมูลค่าเท่าไหร่', 'investment-war-room');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].score).toBeGreaterThan(0);
    });

    it('should route English valuation question correctly', async () => {
      const result = await loader.routeQuestion('What is this worth?', 'investment-war-room');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].score).toBeGreaterThan(0);
    });
  });

  describe('getAgent', () => {
    it('should return agent config by ID', async () => {
      const agent = await loader.getAgent('damodaran-valuation');

      expect(agent).toBeDefined();
      expect(agent?.id).toBe('damodaran-valuation');
      expect(agent?.domain).toBe('investment-war-room');
    });
  });

  describe('getAgentsByDomain', () => {
    it('should return all agents for a domain', async () => {
      const agents = await loader.getAgentsByDomain('investment-war-room');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every((a: AgentConfig) => a.domain === 'investment-war-room')).toBe(true);
    });
  });

  describe('schema round-trip - performance config', () => {
    it('should have nested performance config matching TypeScript interface', async () => {
      const agent = await loader.getAgent('seth-klarman');

      expect(agent).toBeDefined();
      expect(agent?.performance).toBeDefined();
      expect(typeof agent?.performance).toBe('object');
    });

    it('should return correct timeout_seconds from nested performance', async () => {
      const agent = await loader.getAgent('seth-klarman');

      expect(agent?.performance?.timeout_seconds).toBe(90);
    });

    it('should return correct max_tokens from nested performance', async () => {
      const agent = await loader.getAgent('seth-klarman');

      expect(agent?.performance?.max_tokens).toBe(6144);
    });

    it('should have performance config on all loaded agents', async () => {
      const agents = await loader.load();

      expect(agents.data).toBeDefined();
      const agentConfigs = Object.values(agents.data?.agents ?? {}) as AgentConfig[];

      for (const agent of agentConfigs) {
        expect(agent.performance).toBeDefined();
        expect(typeof agent.performance.timeout_seconds).toBe('number');
        expect(typeof agent.performance.max_tokens).toBe('number');
        expect(agent.performance.timeout_seconds).toBeGreaterThan(0);
        expect(agent.performance.max_tokens).toBeGreaterThan(0);
      }
    });
  });

  describe('domain agent coverage', () => {
    it('should load all investment-war-room agents (16 agents)', async () => {
      const agents = await loader.getAgentsByDomain('investment-war-room');
      expect(agents.length).toBeGreaterThanOrEqual(16);

      const ids = agents.map(a => a.id);
      expect(ids).toContain('damodaran-valuation');
      expect(ids).toContain('seth-klarman');
      expect(ids).toContain('kessler-moat');
      expect(ids).toContain('klamran-quality');
      expect(ids).toContain('devil-advocate');
      expect(ids).toContain('forensic-accountant');
      expect(ids).toContain('cio-synthesizer');
      expect(ids).toContain('researcher-set');
      expect(ids).toContain('portfolio-allocator');
      expect(ids).toContain('allocator-steward');
      expect(ids).toContain('consensus-analyst');
      expect(ids).toContain('downside-protection');
      expect(ids).toContain('greenwald-evasion');
      expect(ids).toContain('leveraged-franchise');
      expect(ids).toContain('michael-burry');
      expect(ids).toContain('portfolio-manager');
    });

    it('should load all research-studio agents (6 agents)', async () => {
      const agents = await loader.getAgentsByDomain('research-studio');
      expect(agents.length).toBeGreaterThanOrEqual(6);

      const ids = agents.map(a => a.id);
      expect(ids).toContain('literature-reviewer');
      expect(ids).toContain('methodologist');
      expect(ids).toContain('synthesizer');
      expect(ids).toContain('statistician');
      expect(ids).toContain('peer-reviewer');
      expect(ids).toContain('hypothesis-tester');
    });
  });

  describe('individual agent schema validation - investment-war-room', () => {
    const investmentWarRoomAgents = [
      'damodaran-valuation',
      'seth-klarman',
      'kessler-moat',
      'klamran-quality',
      'devil-advocate',
      'forensic-accountant',
      'cio-synthesizer',
      'researcher-set',
      'portfolio-allocator',
      'allocator-steward',
      'consensus-analyst',
      'downside-protection',
      'greenwald-evasion',
      'leveraged-franchise',
      'michael-burry',
      'portfolio-manager'
    ];

    for (const agentId of investmentWarRoomAgents) {
      it(`${agentId} should have valid config`, async () => {
        const agent = await loader.getAgent(agentId);
        expect(agent).toBeDefined();
        expect(agent?.performance).toBeDefined();
        expect(agent?.performance.timeout_seconds).toBeGreaterThan(0);
        expect(agent?.performance.max_tokens).toBeGreaterThan(0);
        expect(agent?.identity).toBeDefined();
        expect(agent?.identity.persona_file).toBeDefined();
      });
    }
  });

  describe('individual agent schema validation - research-studio', () => {
    const researchStudioAgents = [
      'literature-reviewer',
      'methodologist',
      'synthesizer',
      'statistician',
      'peer-reviewer',
      'hypothesis-tester'
    ];

    for (const agentId of researchStudioAgents) {
      it(`${agentId} should have valid config`, async () => {
        const agent = await loader.getAgent(agentId);
        expect(agent).toBeDefined();
        expect(agent?.performance).toBeDefined();
        expect(agent?.performance.timeout_seconds).toBeGreaterThan(0);
        expect(agent?.performance.max_tokens).toBeGreaterThan(0);
        expect(agent?.identity).toBeDefined();
        expect(agent?.identity.persona_file).toBeDefined();
      });
    }
  });
});
