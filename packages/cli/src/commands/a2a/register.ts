/**
 * A2A Register Command
 *
 * Registers a new A2A agent from an agent card file
 */

import { Command } from 'commander';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { success, error, info, header, warning } from '../../lib/format.js';
import { validateAgentCard } from './util.js';

export function createRegisterCommand(): Command {
  const cmd = new Command('register');
  cmd.description('Register a new A2A agent from an agent card file');

  cmd.argument('<file>', 'Path to agent card file (JSON or YAML)');
  cmd.option('-s, --source <source>', 'Agent source (local|remote)', 'local');
  cmd.option('-f, --force', 'Force registration even if validation warns', false);

  cmd.action(async (file: string, options) => {
    try {
      const filePath = join(process.cwd(), file);

      if (!existsSync(filePath)) {
        error(`Agent card file not found: ${file}`);
        process.exit(1);
      }

      header(`Registering A2A agent from ${file}`);

      // Read and parse agent card
      let agentCard;
      try {
        const content = readFileSync(filePath, 'utf-8');
        agentCard = JSON.parse(content);
      } catch (err) {
        error(`Failed to parse agent card: ${err}`);
        process.exit(1);
      }

      // Validate agent card
      const validation = validateAgentCard(agentCard);
      if (!validation.valid) {
        error('Agent card validation failed:');
        validation.errors?.forEach(e => info(`  - ${e}`));
        process.exit(1);
      }

      info(`Validating agent: ${agentCard.id} - ${agentCard.name}`);

      // Check for behavioral protocol support
      if (agentCard.a2a_config?.behavioral_protocol) {
        const bp = agentCard.a2a_config.behavioral_protocol;
        info('Behavioral protocols:');
        if (bp.implements_challenge_response) info('  ✓ Challenge/Response');
        if (bp.implements_evidence_submission) info('  ✓ Evidence Submission');
        if (bp.implements_debate_protocol) info('  ✓ Debate Protocol');
        info(`  Supported modes: ${bp.supported_interaction_modes.join(', ')}`);
      }

      // Load registry
      const registryPath = join(process.cwd(), '.one4all', 'a2a-registry.json');
      const registryDir = dirname(registryPath);

      if (!existsSync(registryDir)) {
        mkdirSync(registryDir, { recursive: true });
      }

      let registry: any = { agents: {}, metadata: { version: '1.0.0', lastUpdated: new Date().toISOString() } };
      if (existsSync(registryPath)) {
        registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      }

      // Check if agent already exists
      if (registry.agents[agentCard.id] && !options.force) {
        warning(`Agent ${agentCard.id} is already registered. Use --force to update.`);
        process.exit(1);
      }

      // Add agent to registry
      registry.agents[agentCard.id] = {
        ...agentCard,
        registeredAt: new Date().toISOString(),
        source: options.source,
      };

      registry.metadata.lastUpdated = new Date().toISOString();

      // Write registry
      writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      success(`Agent registered successfully!`);
      info(`  ID: ${agentCard.id}`);
      info(`  Name: ${agentCard.name}`);
      info(`  Type: ${agentCard.a2a_config?.endpoint ? 'External' : 'Internal'}`);
      if (agentCard.a2a_config?.endpoint) {
        info(`  Endpoint: ${agentCard.a2a_config.endpoint}`);
      }
      info(`  Trust Level: ${agentCard.trust?.trust_level || 'unverified'}`);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

  return cmd;
}
