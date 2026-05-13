/**
 * MCP Validator Module
 *
 * Validation tools for agents, domains, and constitutions
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as agentStorage from './storage/agent-storage.js';
import * as domainStorage from './storage/domain-storage.js';

/**
 * Get tool definitions for validation
 */
export function getValidatorTools(): Tool[] {
  return [
    {
      name: 'validate_agents',
      description: 'Validate all agents',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: {
            type: 'string',
            description: 'Filter by domain (optional)',
          },
        },
      },
    },
    {
      name: 'validate_domains',
      description: 'Validate all domains',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'validate_constitutions',
      description: 'Validate all constitutions',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'validate_all',
      description: 'Run all validations',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ];
}

/**
 * Handle validate_agents
 */
export async function handleValidateAgents(args: any) {
  try {
    const { domain } = args;

    let agents: agentStorage.AgentIndexEntry[];

    if (domain) {
      agents = await agentStorage.listAgentsByDomain(domain);
    } else {
      agents = await agentStorage.listAgents();
    }

    const results = {
      domain: domain || 'all',
      total: agents.length,
      valid: 0,
      invalid: 0,
      errors: [] as Array<{ agent_id: string; error: string }>,
    };

    for (const agent of agents) {
      try {
        const fullAgent = await agentStorage.readAgent(agent.id);
        if (!fullAgent) {
          results.invalid++;
          results.errors.push({ agent_id: agent.id, error: 'Agent file not found' });
          continue;
        }

        // Basic validation checks
        let isValid = true;
        const errors: string[] = [];

        if (!fullAgent.id || fullAgent.id.trim() === '') {
          errors.push('Missing ID');
          isValid = false;
        }

        if (!fullAgent.name || fullAgent.name.trim() === '') {
          errors.push('Missing name');
          isValid = false;
        }

        if (!fullAgent.domain) {
          errors.push('Missing domain');
          isValid = false;
        }

        if (!fullAgent.model?.primary?.provider) {
          errors.push('Missing provider');
          isValid = false;
        }

        if (isValid) {
          results.valid++;
        } else {
          results.invalid++;
          results.errors.push({ agent_id: agent.id, error: errors.join(', ') });
        }
      } catch (error) {
        results.invalid++;
        results.errors.push({ agent_id: agent.id, error: String(error) });
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...results,
          summary: `${results.valid} valid, ${results.invalid} invalid`,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}

/**
 * Handle validate_domains
 */
export async function handleValidateDomains() {
  try {
    const domains = await domainStorage.listDomains();

    const results = {
      total: domains.length,
      valid: 0,
      invalid: 0,
      errors: [] as Array<{ domain_id: string; errors: string[] }>,
    };

    for (const domain of domains) {
      const validation = await domainStorage.validateDomain(domain.id);

      if (validation.valid) {
        results.valid++;
      } else {
        results.invalid++;
        results.errors.push({ domain_id: domain.id, errors: validation.errors });
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...results,
          summary: `${results.valid} valid, ${results.invalid} invalid`,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}

/**
 * Handle validate_constitutions
 */
export async function handleValidateConstitutions() {
  try {
    // For constitutions, we check if they exist and are readable
    const knownDomains = ['investment-war-room', 'research-studio'];
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    const { homedir } = await import('os');

    const DOMAINS_DIR = join(homedir(), '.one4all', 'domains');

    const results = {
      total: knownDomains.length,
      valid: 0,
      invalid: 0,
      missing: [] as string[],
    };

    for (const domain of knownDomains) {
      const possiblePaths = [
        join(DOMAINS_DIR, domain, 'constitution', 'constitution.yaml'),
        join(process.cwd(), 'domains', domain, 'constitution', 'constitution.yaml'),
      ];

      const found = possiblePaths.some(path => existsSync(path));

      if (found) {
        results.valid++;
      } else {
        results.invalid++;
        results.missing.push(domain);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...results,
          summary: `${results.valid} valid, ${results.invalid} missing`,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}

/**
 * Handle validate_all
 */
export async function handleValidateAll() {
  try {
    const agentsResult = await handleValidateAgents({});
    const domainsResult = await handleValidateDomains();
    const constitutionsResult = await handleValidateConstitutions();

    const agentsData = JSON.parse(agentsResult.content[0].text);
    const domainsData = JSON.parse(domainsResult.content[0].text);
    const constitutionsData = JSON.parse(constitutionsResult.content[0].text);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          agents: agentsData,
          domains: domainsData,
          constitutions: constitutionsData,
          overall: {
            total_valid: (agentsData.valid || 0) + (domainsData.valid || 0) + (constitutionsData.valid || 0),
            total_invalid: (agentsData.invalid || 0) + (domainsData.invalid || 0) + (constitutionsData.invalid || 0),
          },
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}
