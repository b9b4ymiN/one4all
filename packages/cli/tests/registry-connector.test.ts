/**
 * Registry Connector Tests
 *
 * Tests for the singleton PersonaResolver accessor used across CLI handlers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPersonaResolver, getDomainFromBrief } from '../src/lib/registry-connector.js';

describe('registry-connector', () => {
  // Note: The singleton pattern means state persists between tests
  // This is acceptable for testing the behavior

  describe('getPersonaResolver', () => {
    it('should return a PersonaResolver instance', () => {
      const resolver = getPersonaResolver();

      expect(resolver).toBeDefined();
      expect(resolver).toHaveProperty('resolvePersonaPath');
      expect(resolver).toHaveProperty('getKnownAnalysts');
      expect(resolver).toHaveProperty('getPersonaMap');
      expect(resolver).toHaveProperty('getAgent');
      expect(resolver).toHaveProperty('getAgentsByDomain');
    });

    it('should return same instance on repeated calls (singleton pattern)', () => {
      const resolver1 = getPersonaResolver();
      const resolver2 = getPersonaResolver();

      expect(resolver1).toBe(resolver2);
    });

    it('should resolve persona paths for investment-war-room agents', async () => {
      const resolver = getPersonaResolver();

      // Test with a known agent
      const personaPath = await resolver.resolvePersonaPath(
        'consensus-analyst',
        'investment-war-room'
      );

      expect(personaPath).toBeDefined();
      expect(personaPath).toContain('domains');
      expect(personaPath).toContain('investment-war-room');
      expect(personaPath).toContain('.md');
    });

    it('should get known analysts for investment-war-room', async () => {
      const resolver = getPersonaResolver();
      const analysts = await resolver.getKnownAnalysts('investment-war-room');

      expect(analysts).toBeDefined();
      expect(Array.isArray(analysts)).toBe(true);
      expect(analysts.length).toBeGreaterThan(0);

      // Should include core analysts
      const knownAnalysts = [
        'damodaran-valuation',
        'seth-klarman',
        'devil-advocate',
        'consensus-analyst',
      ];

      for (const analyst of knownAnalysts) {
        expect(analysts).toContain(analyst);
      }
    });

    it('should get known analysts for research-studio', async () => {
      const resolver = getPersonaResolver();
      const analysts = await resolver.getKnownAnalysts('research-studio');

      expect(analysts).toBeDefined();
      expect(Array.isArray(analysts)).toBe(true);
    });

    it('should throw error for unknown agent', async () => {
      const resolver = getPersonaResolver();

      await expect(
        resolver.resolvePersonaPath('unknown-analyst', 'investment-war-room')
      ).rejects.toThrow();
    });

    it('should get persona map for domain', async () => {
      const resolver = getPersonaResolver();
      const personaMap = await resolver.getPersonaMap('investment-war-room');

      expect(personaMap).toBeDefined();
      expect(typeof personaMap).toBe('object');

      // Should have entries for agents with persona files
      const agentIds = Object.keys(personaMap);
      expect(agentIds.length).toBeGreaterThan(0);

      // Each path should be absolute and contain domain
      for (const agentId of agentIds) {
        expect(personaMap[agentId]).toContain('/home/dasimoa/one4all/domains/investment-war-room');
      }
    });

    it('should get agent config', async () => {
      const resolver = getPersonaResolver();
      const agent = await resolver.getAgent('consensus-analyst');

      expect(agent).toBeDefined();
      expect(agent?.id).toBe('consensus-analyst');
      expect(agent?.identity).toBeDefined();
    });

    it('should get agents by domain', async () => {
      const resolver = getPersonaResolver();
      const agents = await resolver.getAgentsByDomain('investment-war-room');

      expect(agents).toBeDefined();
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);

      // Each agent should have required properties
      for (const agent of agents) {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('identity');
        expect(agent).toHaveProperty('domain');
      }
    });
  });

  describe('getDomainFromBrief', () => {
    it('should return domain from brief when present', () => {
      const brief = {
        domain: 'research-studio',
        ticker: 'TEST',
      };

      const domain = getDomainFromBrief(brief);
      expect(domain).toBe('research-studio');
    });

    it('should fallback to investment-war-room when domain missing', () => {
      const brief = {
        ticker: 'TEST',
      };

      const domain = getDomainFromBrief(brief);
      expect(domain).toBe('investment-war-room');
    });

    it('should fallback to investment-war-room when brief undefined', () => {
      const domain = getDomainFromBrief(undefined);
      expect(domain).toBe('investment-war-room');
    });

    it('should fallback to investment-war-room when brief null', () => {
      const domain = getDomainFromBrief(null as any);
      expect(domain).toBe('investment-war-room');
    });

    it('should fallback to investment-war-room when domain is empty string', () => {
      const brief = {
        domain: '',
        ticker: 'TEST',
      };

      const domain = getDomainFromBrief(brief);
      expect(domain).toBe('investment-war-room');
    });
  });
});
