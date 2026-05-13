/**
 * A2A Health Command
 *
 * Shows health status of a registered A2A agent
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { success, error, info, header, warning, kv } from '../../lib/format.js';

export function createHealthCommand(): Command {
  const cmd = new Command('health');
  cmd.description('Show health status of a registered A2A agent');

  cmd.argument('<agentId>', 'Agent ID');
  cmd.option('-v, --verbose', 'Show detailed health information', false);

  cmd.action(async (agentId: string, options) => {
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
        process.exit(1);
      }

      header(`Health Status: ${agent.name} (${agent.id})`);

      // Basic health
      const isActive = agent.active !== false;
      const isExternal = !!agent.a2a_config?.endpoint;
      const isHealthy = isActive && (!isExternal || agent.a2a_config?.health_check?.enabled !== false);

      console.log('');
      if (isHealthy) {
        success('Status: Healthy');
      } else {
        warning('Status: Unhealthy');
      }

      // Health details
      kv('Active', isActive ? 'Yes' : 'No');
      kv('Type', isExternal ? 'External' : 'Internal');

      if (isExternal && agent.a2a_config?.health_check) {
        const hc = agent.a2a_config.health_check;
        console.log('\nHealth Check Configuration:');
        kv('Enabled', hc.enabled ? 'Yes' : 'No');
        if (hc.enabled) {
          kv('Interval', `${hc.interval_seconds}s`);
          kv('Endpoint', hc.endpoint || `${agent.a2a_config.endpoint}/health`);
          kv('Timeout', `${hc.timeout_seconds}s`);
        }
      }

      // Trust health
      console.log('\nTrust Status:');
      const trustLevel = agent.trust?.trust_level || 'unverified';
      if (trustLevel === 'trusted' || trustLevel === 'certified') {
        success(`Trust Level: ${trustLevel}`);
      } else if (trustLevel === 'probationary') {
        warning(`Trust Level: ${trustLevel}`);
        if (agent.trust?.probation_expires_at) {
          const expiry = new Date(agent.trust.probation_expires_at);
          kv('Probation Expires', expiry.toLocaleString());
        }
      } else {
        info(`Trust Level: ${trustLevel}`);
      }

      // Behavioral score
      if (agent.trust?.behavioral_score !== undefined) {
        const score = agent.trust.behavioral_score;
        if (score >= 80) {
          success(`Behavioral Score: ${score}/100`);
        } else if (score >= 60) {
          warning(`Behavioral Score: ${score}/100`);
        } else {
          info(`Behavioral Score: ${score}/100`);
        }
      }

      // Verification status
      const verificationStatus = agent.trust?.verification_status || 'pending';
      kv('Verification', verificationStatus);
      if (agent.trust?.last_verified_at) {
        kv('Last Verified', new Date(agent.trust.last_verified_at).toLocaleString());
      }

      // Verbose output
      if (options.verbose) {
        console.log('\nDetailed Information:');
        kv('Registered', new Date(agent.registeredAt).toLocaleString());
        kv('Source', agent.source || 'local');

        if (agent.performance) {
          console.log('\nPerformance:');
          kv('Timeout', `${agent.performance.timeout_seconds}s`);
          kv('Max Tokens', agent.performance.max_tokens);
        }

        if (agent.a2a_config?.behavioral_protocol) {
          console.log('\nBehavioral Protocol:');
          const bp = agent.a2a_config.behavioral_protocol;
          const implementedProtocols = [];
          if (bp.implements_challenge_response) implementedProtocols.push('challenge/response');
          if (bp.implements_evidence_submission) implementedProtocols.push('evidence');
          if (bp.implements_debate_protocol) implementedProtocols.push('debate');
          kv('Protocols', implementedProtocols.join(', ') || 'none');
        }
      }

      // Exit with appropriate code
      process.exit(isHealthy ? 0 : 1);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

  return cmd;
}
