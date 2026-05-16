/**
 * Agent Registry Tests
 *
 * Tests for agent metadata loading and routing functions
 */

import { describe, it, expect } from 'vitest';
import { AgentRegistryLoader } from '../../src/registry/agent-registry.js';

describe('AgentRegistryLoader', () => {
  const loader = new AgentRegistryLoader('/home/dasimoa/one4all');

  describe('getAgentsByExpertise', () => {
    it('should find agents by valuation expertise', async () => {
      const agents = await loader.getAgentsByExpertise('valuation');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.id === 'damodaran-valuation')).toBe(true);
    });

    it('should find agents by downside expertise', async () => {
      const agents = await loader.getAgentsByExpertise('downside');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.id === 'seth-klarman')).toBe(true);
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
      expect(expertAgents.every(a => a.routing_metadata?.model_tier === 'expert')).toBe(true);
    });

    it('should return non-expert tier agents', async () => {
      const nonExpertAgents = await loader.getAgentsByModelTier('non_expert');

      expect(nonExpertAgents.length).toBeGreaterThan(0);
      expect(nonExpertAgents.every(a => a.routing_metadata?.model_tier === 'non_expert')).toBe(true);
    });
  });

  describe('getDebatePartners', () => {
    it('should find debate partners for damodaran-valuation', async () => {
      const partners = await loader.getDebatePartners('damodaran-valuation');

      expect(partners.length).toBeGreaterThan(0);
      expect(partners.some(p => p.id === 'seth-klarman')).toBe(true);
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
      expect(agents.every(a => a.domain === 'investment-war-room')).toBe(true);
    });
  });
});
