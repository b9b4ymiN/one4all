/**
 * A2A Info Command
 *
 * Shows detailed information about a registered A2A agent
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createTable, addTableRow, success, error, info, header, kv } from '../../lib/format.js';

export function createInfoCommand(): Command {
  const cmd = new Command('info');
  cmd.description('Show detailed information about a registered A2A agent');

  cmd.argument('<agentId>', 'Agent ID');

  cmd.action(async (agentId: string) => {
    try {
      const registryPath = join(process.cwd(), '.one4all', 'a2a-registry.json');

      if (!existsSync(registryPath)) {
        error('No A2A agents registered. Use "one4all a2a register" to add agents.');
        process.exit(1);
      }

      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      const agent = registry.agents[agentId];

      if (!agent) {
        error(`Agent not found: ${agentId}`);
        info('Use "one4all a2a list" to see all registered agents.');
        process.exit(1);
      }

      header(`Agent: ${agent.name} (${agent.id})`);

      // Basic Information
      console.log('\nBasic Information:');
      kv('Name', agent.name);
      kv('Version', agent.version);
      kv('Domain', agent.domain);
      kv('Role', agent.role);
      kv('Active', agent.active ? 'Yes' : 'No');
      kv('Description', agent.description);
      if (agent.tags?.length > 0) {
        kv('Tags', agent.tags.join(', '));
      }

      // Type Information
      const agentType = agent.a2a_config?.endpoint ? 'External' : 'Internal';
      console.log('\nType Information:');
      kv('Type', agentType);
      if (agentType === 'External' && agent.a2a_config?.endpoint) {
        kv('Endpoint', agent.a2a_config.endpoint);
        kv('Protocol', agent.a2a_config.protocol || 'http');
        kv('Authentication', agent.a2a_config.authentication?.type || 'none');
      }

      // Capabilities
      console.log('\nCapabilities:');
      kv('Input Types', agent.capabilities.input_types.join(', ') || 'None');
      kv('Output Types', agent.capabilities.output_types.join(', ') || 'None');
      if (agent.capabilities.skills?.length > 0) {
        kv('Skills', agent.capabilities.skills.map((s: any) => s.name).join(', '));
      }

      // Performance
      console.log('\nPerformance:');
      kv('Timeout', `${agent.performance.timeout_seconds}s`);
      kv('Max Tokens', agent.performance.max_tokens);
      kv('Max Retries', agent.performance.max_retries);

      // Trust Information
      console.log('\nTrust Information:');
      kv('Trust Level', agent.trust?.trust_level || 'unverified');
      kv('Verification Status', agent.trust?.verification_status || 'pending');
      if (agent.trust?.behavioral_score) {
        kv('Behavioral Score', `${agent.trust.behavioral_score}/100`);
      }

      // Behavioral Protocol
      if (agent.a2a_config?.behavioral_protocol) {
        console.log('\nBehavioral Protocol:');
        const bp = agent.a2a_config.behavioral_protocol;
        kv('Challenge/Response', bp.implements_challenge_response ? 'Yes' : 'No');
        kv('Evidence Submission', bp.implements_evidence_submission ? 'Yes' : 'No');
        kv('Debate Protocol', bp.implements_debate_protocol ? 'Yes' : 'No');
        kv('Interaction Modes', bp.supported_interaction_modes.join(', '));
      }

      // Output Contract
      console.log('\nOutput Contract:');
      if (agent.output_contract.mandatory_fields?.length > 0) {
        kv('Mandatory Fields', agent.output_contract.mandatory_fields.join(', '));
      }
      if (agent.output_contract.forbidden_content?.length > 0) {
        kv('Forbidden Content', agent.output_contract.forbidden_content.join(', '));
      }

      // Registration Info
      console.log('\nRegistration:');
      kv('Registered At', new Date(agent.registeredAt).toLocaleString());
      kv('Source', agent.source || 'local');
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

  return cmd;
}
