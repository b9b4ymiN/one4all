/**
 * MCP Agent Handler
 *
 * Agent management tools for MCP server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as storage from './storage/agent-storage.js';

/**
 * Get tool definitions for agent management
 */
export function getAgentTools(): Tool[] {
  return [
    {
      name: 'agent_create',
      description: 'Create a new agent',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'Unique agent ID (e.g., tech-analyst)',
          },
          name: {
            type: 'string',
            description: 'Agent display name',
          },
          domain: {
            type: 'string',
            description: 'Domain ID (e.g., investment-war-room)',
          },
          role: {
            type: 'string',
            description: 'Agent role (e.g., analyst, researcher)',
          },
          description: {
            type: 'string',
            description: 'Agent description',
          },
          provider: {
            type: 'string',
            description: 'Model provider (e.g., claude-cli, gemini-cli)',
          },
          model: {
            type: 'string',
            description: 'Model name (e.g., claude-3-opus)',
          },
        },
        required: ['id', 'name', 'domain', 'role', 'provider', 'model'],
      },
    },
    {
      name: 'agent_show',
      description: 'Show agent details',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent_id: {
            type: 'string',
            description: 'Agent ID',
          },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'agent_edit',
      description: 'Edit an existing agent',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent_id: {
            type: 'string',
            description: 'Agent ID to edit',
          },
          name: {
            type: 'string',
            description: 'New name',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          active: {
            type: 'boolean',
            description: 'Set active status',
          },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'agent_remove',
      description: 'Delete an agent',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent_id: {
            type: 'string',
            description: 'Agent ID to delete',
          },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'agent_list',
      description: 'List all agents',
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
      name: 'agent_import',
      description: 'Import agents from YAML files (from source domains directory)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: {
            type: 'string',
            description: 'Domain to import agents from',
          },
        },
      },
    },
    {
      name: 'agent_export',
      description: 'Export agent configuration as JSON',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent_id: {
            type: 'string',
            description: 'Agent ID to export',
          },
        },
        required: ['agent_id'],
      },
    },
  ];
}

/**
 * Handle agent_create
 */
export async function handleAgentCreate(args: any) {
  try {
    const { id, name, domain, role, description, provider, model } = args;

    const exists = await storage.agentExists(id);
    if (exists) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Agent already exists', id }) }],
        isError: true,
      };
    }

    const agent: storage.RuntimeAgent = {
      id,
      name,
      domain,
      role,
      description,
      model: {
        primary: { provider, model },
      },
      active: true,
      _runtime: {
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString(),
      },
    };

    await storage.writeAgent(agent);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Agent created successfully',
          agent: { id, name, domain, role },
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
 * Handle agent_show
 */
export async function handleAgentShow(args: any) {
  try {
    const { agent_id } = args;

    const agent = await storage.readAgent(agent_id);

    if (!agent) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Agent not found', agent_id }) }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}

/**
 * Handle agent_edit
 */
export async function handleAgentEdit(args: any) {
  try {
    const { agent_id, name, description, active } = args;

    const agent = await storage.readAgent(agent_id);

    if (!agent) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Agent not found', agent_id }) }],
        isError: true,
      };
    }

    // Backup before editing
    await storage.backupAgent(agent_id);

    if (name !== undefined) agent.name = name;
    if (description !== undefined) agent.description = description;
    if (active !== undefined) agent.active = active;

    await storage.writeAgent(agent);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Agent updated successfully',
          agent: { id: agent.id, name: agent.name },
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
 * Handle agent_remove
 */
export async function handleAgentRemove(args: any) {
  try {
    const { agent_id } = args;

    const exists = await storage.agentExists(agent_id);
    if (!exists) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Agent not found', agent_id }) }],
        isError: true,
      };
    }

    await storage.deleteAgent(agent_id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Agent deleted successfully',
          agent_id,
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
 * Handle agent_list
 */
export async function handleAgentList(args: any) {
  try {
    const { domain } = args;

    let agents: storage.AgentIndexEntry[];

    if (domain) {
      agents = await storage.listAgentsByDomain(domain);
    } else {
      agents = await storage.listAgents();
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          agents,
          count: agents.length,
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
 * Handle agent_import
 */
export async function handleAgentImport(args: any) {
  try {
    const { domain } = args;

    // Note: This is a simplified implementation
    // In a full implementation, this would scan the source YAML files
    // and import agents into runtime storage

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Agent import not yet implemented - requires YAML parsing from source files',
          domain,
          note: 'Use CLI command: one4all agents import --domain ' + domain,
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
 * Handle agent_export
 */
export async function handleAgentExport(args: any) {
  try {
    const { agent_id } = args;

    const agent = await storage.readAgent(agent_id);

    if (!agent) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Agent not found', agent_id }) }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(agent, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}
