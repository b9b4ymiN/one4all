/**
 * Registry Connector
 *
 * Shared utility for accessing the PersonaResolver from CLI handlers.
 * Provides a singleton pattern to avoid creating multiple registry instances.
 */

import { AgentRegistryLoader, PersonaResolver } from '@one4all/kernel';

let resolverInstance: PersonaResolver | undefined;
let registryInstance: AgentRegistryLoader | undefined;

/**
 * Get the shared PersonaResolver instance.
 * Lazily initialized on first call.
 */
export function getPersonaResolver(): PersonaResolver {
  if (!resolverInstance) {
    // Get the base path (project root)
    const basePath = process.cwd();

    // Create registry and resolver
    registryInstance = new AgentRegistryLoader(basePath);
    resolverInstance = new PersonaResolver(registryInstance, basePath);
  }

  return resolverInstance;
}

/**
 * Get domain from mission brief, with fallback.
 * Priority: brief.domain > 'investment-war-room'
 */
export function getDomainFromBrief(brief: any | undefined): string {
  return brief?.domain || 'investment-war-room';
}
