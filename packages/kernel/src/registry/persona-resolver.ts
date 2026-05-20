/**
 * Persona Resolver
 *
 * Resolves agent persona file paths using the registry.
 * Reads identity.persona_file from agent configs and resolves to absolute paths.
 */

import * as path from 'node:path';
import type { AgentConfig } from './types.js';
import { AgentRegistryLoader } from './agent-registry.js';

/**
 * Persona Resolver - resolves persona file paths from agent registry
 */
export class PersonaResolver {
  constructor(
    private readonly agentRegistry: AgentRegistryLoader,
    private readonly basePath: string
  ) {}

  /**
   * Resolve the persona file path for a specific agent.
   * Reads identity.persona_file from the agent config and resolves it
   * relative to the domain root directory.
   *
   * @param agentId - The agent ID to resolve
   * @param domain - The domain ID (e.g., 'investment-war-room')
   * @returns Absolute path to the persona file
   * @throws Error if agent not found, persona_file missing, or domain invalid
   */
  async resolvePersonaPath(agentId: string, domain: string): Promise<string> {
    const agent = await this.agentRegistry.getAgent(agentId);

    if (!agent) {
      throw new Error(`Agent '${agentId}' not found in registry`);
    }

    if (!agent.identity?.persona_file) {
      throw new Error(
        `Agent '${agentId}' has no persona_file configured in identity`
      );
    }

    // Resolve relative to domains/{domain}/ directory
    const domainPersonaPath = path.join(
      this.basePath,
      'domains',
      domain,
      agent.identity.persona_file
    );

    return domainPersonaPath;
  }

  /**
   * Get all known analyst IDs for a domain.
   * Returns agent IDs from the registry for the given domain.
   *
   * @param domain - The domain ID (e.g., 'investment-war-room')
   * @returns Array of agent IDs
   */
  async getKnownAnalysts(domain: string): Promise<string[]> {
    const agents = await this.agentRegistry.getAgentsByDomain(domain);
    return agents.map((a) => a.id);
  }

  /**
   * Get a mapping of agent IDs to their resolved persona paths for a domain.
   *
   * @param domain - The domain ID (e.g., 'investment-war-room')
   * @returns Record mapping agent ID → absolute persona path
   */
  async getPersonaMap(domain: string): Promise<Record<string, string>> {
    const agents = await this.agentRegistry.getAgentsByDomain(domain);
    const personaMap: Record<string, string> = {};

    for (const agent of agents) {
      if (agent.identity?.persona_file) {
        const resolvedPath = path.join(
          this.basePath,
          'domains',
          domain,
          agent.identity.persona_file
        );
        personaMap[agent.id] = resolvedPath;
      }
    }

    return personaMap;
  }

  /**
   * Get agent config from the registry
   */
  async getAgent(agentId: string): Promise<AgentConfig | undefined> {
    return this.agentRegistry.getAgent(agentId);
  }

  /**
   * Get all agents for a domain
   */
  async getAgentsByDomain(domain: string): Promise<AgentConfig[]> {
    return this.agentRegistry.getAgentsByDomain(domain);
  }
}

/**
 * Create a persona resolver for a specific base path
 */
export function createPersonaResolver(
  basePath: string,
  agentRegistry?: AgentRegistryLoader
): PersonaResolver {
  const registry =
    agentRegistry ?? new AgentRegistryLoader(basePath);
  return new PersonaResolver(registry, basePath);
}
