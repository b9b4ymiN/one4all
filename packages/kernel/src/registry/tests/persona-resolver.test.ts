/**
 * Persona Resolver Tests
 *
 * Tests for persona file path resolution using the registry
 */

import { describe, it, expect } from 'vitest';
import { AgentRegistryLoader } from '../agent-registry.js';
import { PersonaResolver, createPersonaResolver } from '../persona-resolver.js';

describe('PersonaResolver', () => {
  const basePath = '/home/dasimoa/one4all';
  const agentRegistry = new AgentRegistryLoader(basePath);
  const resolver = new PersonaResolver(agentRegistry, basePath);

  // Complete agent lists for each domain
  const investmentWarRoomAgents = [
    'seth-klarman',
    'michael-burry',
    'damodaran-valuation',
    'devil-advocate',
    'consensus-analyst',
    'forensic-accountant',
    'greenwald-evasion',
    'kessler-moat',
    'klamran-quality',
    'leveraged-franchise',
    'downside-protection',
    'portfolio-allocator',
    'portfolio-manager',
    'cio-synthesizer',
    'allocator-steward',
    'researcher-set'
  ];

  const researchStudioAgents = [
    'synthesizer',
    'literature-reviewer',
    'methodologist',
    'statistician',
    'peer-reviewer',
    'hypothesis-tester'
  ];

  // Expected persona file mappings for investment-war-room
  const investmentPersonaMappings: Record<string, string> = {
    'seth-klarman': 'klarman.md',
    'michael-burry': 'burry.md',
    'damodaran-valuation': 'damodaran.md',
    'devil-advocate': 'devil-advocate.md',
    'consensus-analyst': 'consensus.md',
    'forensic-accountant': 'forensic-accountant.md',
    'greenwald-evasion': 'greenwald.md',
    'kessler-moat': 'kessler.md',
    'klamran-quality': 'klamran.md',
    'leveraged-franchise': 'leveraged-franchise.md',
    'downside-protection': 'downside-analyst.md',
    'portfolio-allocator': 'portfolio-allocator.md',
    'portfolio-manager': 'portfolio-manager.md',
    'cio-synthesizer': 'cio-synthesizer.md',
    'allocator-steward': 'allocator.md',
    'researcher-set': 'researcher-set.md'
  };

  // Expected persona file mappings for research-studio
  const researchPersonaMappings: Record<string, string> = {
    'synthesizer': 'synthesizer.md',
    'literature-reviewer': 'literature-reviewer.md',
    'methodologist': 'methodologist.md',
    'statistician': 'statistician.md',
    'peer-reviewer': 'peer-reviewer.md',
    'hypothesis-tester': 'hypothesis-tester.md'
  };

  describe('resolvePersonaPath', () => {
    it('should resolve persona path for seth-klarman agent', async () => {
      const personaPath = await resolver.resolvePersonaPath(
        'seth-klarman',
        'investment-war-room'
      );

      expect(personaPath).toBe(
        '/home/dasimoa/one4all/domains/investment-war-room/personas/klarman.md'
      );
    });

    it('should resolve persona path for damodaran-valuation agent', async () => {
      const personaPath = await resolver.resolvePersonaPath(
        'damodaran-valuation',
        'investment-war-room'
      );

      expect(personaPath).toBe(
        '/home/dasimoa/one4all/domains/investment-war-room/personas/damodaran.md'
      );
    });

    it('should resolve persona path for synthesizer agent', async () => {
      const personaPath = await resolver.resolvePersonaPath(
        'synthesizer',
        'research-studio'
      );

      expect(personaPath).toBe(
        '/home/dasimoa/one4all/domains/research-studio/personas/synthesizer.md'
      );
    });

    it('should resolve persona path for literature-reviewer agent', async () => {
      const personaPath = await resolver.resolvePersonaPath(
        'literature-reviewer',
        'research-studio'
      );

      expect(personaPath).toBe(
        '/home/dasimoa/one4all/domains/research-studio/personas/literature-reviewer.md'
      );
    });

    it('should throw error for non-existent agent', async () => {
      await expect(
        resolver.resolvePersonaPath('non-existent-agent', 'investment-war-room')
      ).rejects.toThrow("Agent 'non-existent-agent' not found");
    });

    it('should resolve persona path for valid agent even with non-existent domain', async () => {
      // Note: resolvePersonaPath doesn't validate domain existence, it just constructs paths
      // So this will succeed but the path may not actually exist
      const personaPath = await resolver.resolvePersonaPath(
        'seth-klarman',
        'non-existent-domain'
      );

      expect(personaPath).toBe('/home/dasimoa/one4all/domains/non-existent-domain/personas/klarman.md');
    });
  });

  describe('Investment-war-room agents persona resolution', () => {
    it('should resolve persona paths for all investment-war-room agents', async () => {
      for (const agentId of investmentWarRoomAgents) {
        const personaPath = await resolver.resolvePersonaPath(
          agentId,
          'investment-war-room'
        );

        expect(personaPath).toBeTruthy();
        expect(typeof personaPath).toBe('string');
        expect(personaPath).toContain('/domains/investment-war-room/personas/');
        expect(personaPath).toContain('.md');

        // Verify the exact expected filename
        const expectedFilename = investmentPersonaMappings[agentId];
        expect(personaPath).toBe(
          `/home/dasimoa/one4all/domains/investment-war-room/personas/${expectedFilename}`
        );
      }
    });

    it('should handle all investment-war-room agents without errors', async () => {
      const promises = investmentWarRoomAgents.map(agentId =>
        resolver.resolvePersonaPath(agentId, 'investment-war-room')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(investmentWarRoomAgents.length);
      results.forEach(path => {
        expect(path).toBeTruthy();
        expect(typeof path).toBe('string');
      });
    });
  });

  describe('Research-studio agents persona resolution', () => {
    it('should resolve persona paths for all research-studio agents', async () => {
      for (const agentId of researchStudioAgents) {
        const personaPath = await resolver.resolvePersonaPath(
          agentId,
          'research-studio'
        );

        expect(personaPath).toBeTruthy();
        expect(typeof personaPath).toBe('string');
        expect(personaPath).toContain('/domains/research-studio/personas/');
        expect(personaPath).toContain('.md');

        // Verify the exact expected filename
        const expectedFilename = researchPersonaMappings[agentId];
        expect(personaPath).toBe(
          `/home/dasimoa/one4all/domains/research-studio/personas/${expectedFilename}`
        );
      }
    });

    it('should handle all research-studio agents without errors', async () => {
      const promises = researchStudioAgents.map(agentId =>
        resolver.resolvePersonaPath(agentId, 'research-studio')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(researchStudioAgents.length);
      results.forEach(path => {
        expect(path).toBeTruthy();
        expect(typeof path).toBe('string');
      });
    });
  });

  describe('getKnownAnalysts', () => {
    it('should return all analyst IDs for investment-war-room domain', async () => {
      const analysts = await resolver.getKnownAnalysts('investment-war-room');

      expect(analysts.length).toBeGreaterThan(0);
      expect(analysts).toContain('seth-klarman');
      expect(analysts).toContain('damodaran-valuation');
      expect(analysts).toContain('michael-burry');
    });

    it('should return correct count for investment-war-room domain', async () => {
      const analysts = await resolver.getKnownAnalysts('investment-war-room');

      expect(analysts).toHaveLength(investmentWarRoomAgents.length);
    });

    it('should contain all expected investment-war-room agent IDs', async () => {
      const analysts = await resolver.getKnownAnalysts('investment-war-room');

      for (const agentId of investmentWarRoomAgents) {
        expect(analysts).toContain(agentId);
      }
    });

    it('should return all analyst IDs for research-studio domain', async () => {
      const analysts = await resolver.getKnownAnalysts('research-studio');

      expect(analysts.length).toBeGreaterThan(0);
      expect(analysts).toContain('synthesizer');
      expect(analysts).toContain('literature-reviewer');
      expect(analysts).toContain('methodologist');
    });

    it('should return correct count for research-studio domain', async () => {
      const analysts = await resolver.getKnownAnalysts('research-studio');

      expect(analysts).toHaveLength(researchStudioAgents.length);
    });

    it('should contain all expected research-studio agent IDs', async () => {
      const analysts = await resolver.getKnownAnalysts('research-studio');

      for (const agentId of researchStudioAgents) {
        expect(analysts).toContain(agentId);
      }
    });

    it('should return empty array for non-existent domain', async () => {
      const analysts = await resolver.getKnownAnalysts('non-existent-domain');

      expect(analysts).toEqual([]);
    });
  });

  describe('getPersonaMap', () => {
    it('should return map of agent ID to persona path for investment-war-room', async () => {
      const personaMap = await resolver.getPersonaMap('investment-war-room');

      expect(Object.keys(personaMap).length).toBeGreaterThan(0);
      expect(personaMap['seth-klarman']).toBe(
        '/home/dasimoa/one4all/domains/investment-war-room/personas/klarman.md'
      );
      expect(personaMap['damodaran-valuation']).toBe(
        '/home/dasimoa/one4all/domains/investment-war-room/personas/damodaran.md'
      );
    });

    it('should return complete persona map for investment-war-room', async () => {
      const personaMap = await resolver.getPersonaMap('investment-war-room');

      // Should have entries for all agents
      expect(Object.keys(personaMap)).toHaveLength(investmentWarRoomAgents.length);

      // Each entry should match expected mapping
      for (const agentId of investmentWarRoomAgents) {
        expect(personaMap[agentId]).toBeTruthy();
        const expectedFilename = investmentPersonaMappings[agentId];
        expect(personaMap[agentId]).toBe(
          `/home/dasimoa/one4all/domains/investment-war-room/personas/${expectedFilename}`
        );
      }
    });

    it('should return complete persona map for research-studio', async () => {
      const personaMap = await resolver.getPersonaMap('research-studio');

      // Should have entries for all agents
      expect(Object.keys(personaMap)).toHaveLength(researchStudioAgents.length);

      // Each entry should match expected mapping
      for (const agentId of researchStudioAgents) {
        expect(personaMap[agentId]).toBeTruthy();
        const expectedFilename = researchPersonaMappings[agentId];
        expect(personaMap[agentId]).toBe(
          `/home/dasimoa/one4all/domains/research-studio/personas/${expectedFilename}`
        );
      }
    });

    it('should return empty object for non-existent domain', async () => {
      const personaMap = await resolver.getPersonaMap('non-existent-domain');

      expect(personaMap).toEqual({});
    });
  });

  describe('Error cases', () => {
    it('should throw error for resolvePersonaPath with non-existent agent', async () => {
      await expect(
        resolver.resolvePersonaPath('non-existent-agent', 'investment-war-room')
      ).rejects.toThrow("Agent 'non-existent-agent' not found");
    });

    it('should handle resolvePersonaPath for non-existent domain gracefully', async () => {
      // resolvePersonaPath doesn't validate domain existence, it just constructs paths
      // So a valid agent with any domain string will succeed
      const personaPath = await resolver.resolvePersonaPath(
        'seth-klarman',
        'non-existent-domain'
      );

      // It will return a path using the provided domain
      expect(personaPath).toBe('/home/dasimoa/one4all/domains/non-existent-domain/personas/klarman.md');
    });

    it('should return empty array for getKnownAnalysts with non-existent domain', async () => {
      const analysts = await resolver.getKnownAnalysts('non-existent-domain');

      expect(analysts).toEqual([]);
      expect(analysts).toHaveLength(0);
    });

    it('should return empty object for getPersonaMap with non-existent domain', async () => {
      const personaMap = await resolver.getPersonaMap('non-existent-domain');

      expect(personaMap).toEqual({});
      expect(Object.keys(personaMap)).toHaveLength(0);
    });
  });

  describe('createPersonaResolver', () => {
    it('should create resolver with default agent registry', async () => {
      const resolver = createPersonaResolver(basePath);
      const analysts = await resolver.getKnownAnalysts('investment-war-room');

      expect(analysts.length).toBeGreaterThan(0);
    });
  });
});
