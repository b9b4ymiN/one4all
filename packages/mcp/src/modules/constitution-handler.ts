/**
 * MCP Constitution Handler
 *
 * Constitution management tools for MCP server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

const DOMAINS_DIR = join(homedir(), '.one4all', 'domains');

/**
 * Get tool definitions for constitution management
 */
export function getConstitutionTools(): Tool[] {
  return [
    {
      name: 'constitution_load',
      description: 'Load constitution rules for a domain',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: {
            type: 'string',
            description: 'Domain ID',
          },
        },
        required: ['domain'],
      },
    },
    {
      name: 'constitution_validate',
      description: 'Validate a domain constitution',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: {
            type: 'string',
            description: 'Domain ID',
          },
        },
        required: ['domain'],
      },
    },
    {
      name: 'constitution_list',
      description: 'List available constitutions',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ];
}

/**
 * Handle constitution_load
 */
export async function handleConstitutionLoad(args: any) {
  try {
    const { domain } = args;

    // Try multiple possible paths for constitution files
    const possiblePaths = [
      join(DOMAINS_DIR, domain, 'constitution', 'constitution.yaml'),
      join(DOMAINS_DIR, domain, 'constitution.yaml'),
      join(process.cwd(), 'domains', domain, 'constitution', 'constitution.yaml'),
    ];

    let content = '';
    let foundPath = '';

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        content = await readFile(path, 'utf-8');
        foundPath = path;
        break;
      }
    }

    if (!content) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Constitution not found',
            domain,
            searched_paths: possiblePaths,
          }),
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          domain,
          path: foundPath,
          content,
        }),
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
 * Handle constitution_validate
 */
export async function handleConstitutionValidate(args: any) {
  try {
    const { domain } = args;

    // Check if constitution file exists
    const possiblePaths = [
      join(DOMAINS_DIR, domain, 'constitution', 'constitution.yaml'),
      join(DOMAINS_DIR, domain, 'constitution.yaml'),
      join(process.cwd(), 'domains', domain, 'constitution', 'constitution.yaml'),
    ];

    let foundPath = '';

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        foundPath = path;
        break;
      }
    }

    if (!foundPath) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            domain,
            valid: false,
            errors: ['Constitution file not found'],
          }),
        }],
      };
    }

    // Basic validation - check if file is readable
    try {
      const content = await readFile(foundPath, 'utf-8');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            domain,
            valid: true,
            path: foundPath,
            rules_count: content.split('---').length - 1,
            message: 'Constitution is valid',
          }),
        }],
      };
    } catch (readError) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            domain,
            valid: false,
            errors: ['Failed to read constitution file'],
          }),
        }],
      };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}

/**
 * Handle constitution_list
 */
export async function handleConstitutionList() {
  try {
    // Return list of domains that have constitutions
    const domainsWithConstitutions: string[] = [];

    // Check known domains
    const knownDomains = ['investment-war-room', 'research-studio'];

    for (const domain of knownDomains) {
      const possiblePaths = [
        join(DOMAINS_DIR, domain, 'constitution', 'constitution.yaml'),
        join(process.cwd(), 'domains', domain, 'constitution', 'constitution.yaml'),
      ];

      for (const path of possiblePaths) {
        if (existsSync(path)) {
          domainsWithConstitutions.push(domain);
          break;
        }
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          constitutions: domainsWithConstitutions,
          count: domainsWithConstitutions.length,
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
