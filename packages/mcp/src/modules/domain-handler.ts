/**
 * MCP Domain Handler
 *
 * Domain management tools for MCP server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as storage from './storage/domain-storage.js';

/**
 * Get tool definitions for domain management
 */
export function getDomainTools(): Tool[] {
  return [
    {
      name: 'domain_create',
      description: 'Create a new domain',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'Unique domain ID (e.g., research-lab)',
          },
          name: {
            type: 'string',
            description: 'Domain display name',
          },
          description: {
            type: 'string',
            description: 'Domain description',
          },
        },
        required: ['id', 'name'],
      },
    },
    {
      name: 'domain_show',
      description: 'Show domain details',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain_id: {
            type: 'string',
            description: 'Domain ID',
          },
        },
        required: ['domain_id'],
      },
    },
    {
      name: 'domain_edit',
      description: 'Edit an existing domain',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain_id: {
            type: 'string',
            description: 'Domain ID to edit',
          },
          name: {
            type: 'string',
            description: 'New name',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
        },
        required: ['domain_id'],
      },
    },
    {
      name: 'domain_remove',
      description: 'Delete a domain',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain_id: {
            type: 'string',
            description: 'Domain ID to delete',
          },
        },
        required: ['domain_id'],
      },
    },
    {
      name: 'domain_list',
      description: 'List all domains',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'domain_validate',
      description: 'Validate a domain configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain_id: {
            type: 'string',
            description: 'Domain ID to validate',
          },
        },
        required: ['domain_id'],
      },
    },
  ];
}

/**
 * Handle domain_create
 */
export async function handleDomainCreate(args: any) {
  try {
    const { id, name, description } = args;

    const exists = await storage.domainExists(id);
    if (exists) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Domain already exists', id }) }],
        isError: true,
      };
    }

    const domain: storage.RuntimeDomain = {
      id,
      name,
      description,
      agent_ids: [],
      _runtime: {
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        constitution_rules: 0,
      },
    };

    await storage.writeDomain(domain);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Domain created successfully',
          domain: { id, name, description },
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
 * Handle domain_show
 */
export async function handleDomainShow(args: any) {
  try {
    const { domain_id } = args;

    const domain = await storage.readDomain(domain_id);

    if (!domain) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Domain not found', domain_id }) }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(domain, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}

/**
 * Handle domain_edit
 */
export async function handleDomainEdit(args: any) {
  try {
    const { domain_id, name, description } = args;

    const domain = await storage.readDomain(domain_id);

    if (!domain) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Domain not found', domain_id }) }],
        isError: true,
      };
    }

    // Backup before editing
    await storage.backupDomain(domain_id);

    if (name !== undefined) domain.name = name;
    if (description !== undefined) domain.description = description;

    await storage.writeDomain(domain);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Domain updated successfully',
          domain: { id: domain.id, name: domain.name },
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
 * Handle domain_remove
 */
export async function handleDomainRemove(args: any) {
  try {
    const { domain_id } = args;

    const exists = await storage.domainExists(domain_id);
    if (!exists) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Domain not found', domain_id }) }],
        isError: true,
      };
    }

    await storage.deleteDomain(domain_id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Domain deleted successfully',
          domain_id,
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
 * Handle domain_list
 */
export async function handleDomainList() {
  try {
    const domains = await storage.listDomains();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          domains,
          count: domains.length,
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
 * Handle domain_validate
 */
export async function handleDomainValidate(args: any) {
  try {
    const { domain_id } = args;

    const result = await storage.validateDomain(domain_id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          domain_id,
          valid: result.valid,
          errors: result.errors,
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
