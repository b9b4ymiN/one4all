/**
 * A2A Verify Command
 *
 * Runs trust verification on a registered A2A agent
 */

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { success, error, info, header, warning, kv } from '../../lib/format.js';
import { validateAgentCard } from './util.js';

export function createVerifyCommand(): Command {
  const cmd = new Command('verify');
  cmd.description('Run trust verification on a registered A2A agent');

  cmd.argument('<agentId>', 'Agent ID');
  cmd.option('-f, --full', 'Run full verification including behavioral tests', false);
  cmd.option('--update', 'Update agent trust status in registry after verification', false);

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

      header(`Verifying Agent: ${agent.name} (${agent.id})`);

      // Run verification checks
      const checks: { name: string; passed: boolean; details?: string }[] = [];

      // 1. Schema Validation
      info('Running schema validation...');
      const validation = validateAgentCard(agent);
      checks.push({
        name: 'Schema Validation',
        passed: validation.valid,
        details: validation.valid ? 'All fields valid' : validation.errors?.join(', '),
      });

      // 2. Behavioral Protocol Consistency
      info('Checking behavioral protocol consistency...');
      let bpConsistent = true;
      let bpDetails = 'Consistent';
      if (agent.a2a_config?.behavioral_protocol) {
        const bp = agent.a2a_config.behavioral_protocol;
        if (bp.implements_challenge_response && !agent.capabilities.input_types.includes('challenge')) {
          bpConsistent = false;
          bpDetails = 'Claims challenge/response but missing challenge input type';
        } else if (bp.implements_evidence_submission && !agent.capabilities.output_types.includes('evidence')) {
          bpConsistent = false;
          bpDetails = 'Claims evidence submission but missing evidence output type';
        } else if (bp.implements_debate_protocol && !agent.capabilities.input_types.includes('debate')) {
          bpConsistent = false;
          bpDetails = 'Claims debate protocol but missing debate input type';
        }
      }
      checks.push({
        name: 'Behavioral Protocol Consistency',
        passed: bpConsistent,
        details: bpDetails,
      });

      // 3. Required Fields
      info('Checking required fields...');
      const hasRequiredFields = !!(
        agent.id &&
        agent.name &&
        agent.version &&
        agent.domain &&
        agent.role &&
        agent.capabilities
      );
      checks.push({
        name: 'Required Fields',
        passed: hasRequiredFields,
        details: hasRequiredFields ? 'All required fields present' : 'Missing required fields',
      });

      // 4. Performance Configuration
      info('Checking performance configuration...');
      const performanceValid = !!(
        agent.performance?.timeout_seconds &&
        agent.performance?.max_tokens &&
        agent.performance?.timeout_seconds >= 10 &&
        agent.performance?.timeout_seconds <= 600
      );
      checks.push({
        name: 'Performance Configuration',
        passed: performanceValid,
        details: performanceValid
          ? `Timeout: ${agent.performance.timeout_seconds}s, Max tokens: ${agent.performance.max_tokens}`
          : 'Invalid performance configuration',
      });

      // 5. Output Contract
      info('Validating output contract...');
      const outputContractValid = !!agent.output_contract;
      checks.push({
        name: 'Output Contract',
        passed: outputContractValid,
        details: outputContractValid
          ? `Mandatory fields: ${agent.output_contract.mandatory_fields.length || 0}`
          : 'Missing output contract',
      });

      // 6. External Agent Configuration
      if (agent.a2a_config?.endpoint) {
        info('Validating external agent configuration...');
        const hasValidEndpoint =
          agent.a2a_config.endpoint.startsWith('http://') ||
          agent.a2a_config.endpoint.startsWith('https://');
        checks.push({
          name: 'External Agent Configuration',
          passed: hasValidEndpoint,
          details: hasValidEndpoint
            ? `Endpoint: ${agent.a2a_config.endpoint}`
            : 'Invalid endpoint URL',
        });
      }

      // Display results
      console.log('\nVerification Results:');
      console.log('');

      let allPassed = true;
      for (const check of checks) {
        if (check.passed) {
          success(`✓ ${check.name}`);
          if (check.details) info(`  ${check.details}`);
        } else {
          warning(`✗ ${check.name}`);
          if (check.details) info(`  ${check.details}`);
          allPassed = false;
        }
      }

      // Calculate trust score
      const passedCount = checks.filter(c => c.passed).length;
      const score = Math.round((passedCount / checks.length) * 100);

      console.log('');
      header(`Trust Score: ${score}/100`);

      // Determine trust level
      let newTrustLevel = 'unverified';
      if (score === 100) {
        newTrustLevel = 'trusted';
      } else if (score >= 70) {
        newTrustLevel = 'probationary';
      }

      if (allPassed) {
        success('Verification passed!');
        kv('Recommended Trust Level', newTrustLevel);
      } else {
        warning('Verification failed with issues');
        kv('Recommended Trust Level', newTrustLevel);
      }

      // Update registry if requested
      if (options.update) {
        agent.trust = {
          ...agent.trust,
          trust_level: newTrustLevel,
          verification_status: allPassed ? 'verified' : 'failed',
          behavioral_score: score,
          last_verified_at: new Date().toISOString(),
          verification_method: 'cli_verification',
        };

        registry.metadata.lastUpdated = new Date().toISOString();
        writeFileSync(registryPath, JSON.stringify(registry, null, 2));

        info('\nRegistry updated with verification results.');
      }

      process.exit(allPassed ? 0 : 1);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

  return cmd;
}
