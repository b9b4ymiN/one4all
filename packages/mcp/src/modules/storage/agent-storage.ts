/**
 * MCP Agent Storage
 *
 * Simplified agent storage for MCP server.
 * Stores agent configurations in ~/.one4all/agents/
 */

import { mkdir, readFile, writeFile, readdir, copyFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

const AGENTS_DIR = join(homedir(), '.one4all', 'agents');
const INDEX_FILE = join(AGENTS_DIR, '.index.json');
const BACKUPS_DIR = join(AGENTS_DIR, '.backups');

export interface AgentIndexEntry {
  id: string;
  name: string;
  domain: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface RuntimeAgent {
  id: string;
  name: string;
  domain: string;
  role: string;
  description?: string;
  model: {
    primary: {
      provider: string;
      model: string;
    };
  };
  active?: boolean;
  _runtime: {
    source_path?: string;
    created_at: string;
    last_modified: string;
    imported_at?: string;
  };
}

export interface AgentIndex {
  agents: AgentIndexEntry[];
  last_updated: string;
}

/**
 * Ensure the agents directory structure exists
 */
export async function ensureAgentsDir(): Promise<void> {
  const dirs = [AGENTS_DIR, BACKUPS_DIR];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  if (!existsSync(INDEX_FILE)) {
    await writeFile(INDEX_FILE, JSON.stringify({ agents: [], last_updated: new Date().toISOString() }, null, 2));
  }
}

/**
 * Read the agent index
 */
export async function readAgentIndex(): Promise<AgentIndex> {
  await ensureAgentsDir();

  try {
    const content = await readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { agents: [], last_updated: new Date().toISOString() };
  }
}

/**
 * Write the agent index
 */
export async function writeAgentIndex(index: AgentIndex): Promise<void> {
  await ensureAgentsDir();
  index.last_updated = new Date().toISOString();
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Read an agent from storage
 */
export async function readAgent(agentId: string): Promise<RuntimeAgent | null> {
  await ensureAgentsDir();

  const agentPath = join(AGENTS_DIR, `${agentId}.json`);

  try {
    const content = await readFile(agentPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write an agent to storage
 */
export async function writeAgent(agent: RuntimeAgent): Promise<void> {
  await ensureAgentsDir();

  const agentPath = join(AGENTS_DIR, `${agent.id}.json`);

  agent._runtime.last_modified = new Date().toISOString();

  await writeFile(agentPath, JSON.stringify(agent, null, 2));

  // Update index
  await updateAgentIndex(agent);
}

/**
 * Update agent index entry
 */
async function updateAgentIndex(agent: RuntimeAgent): Promise<void> {
  const index = await readAgentIndex();

  const existingIndex = index.agents.findIndex(a => a.id === agent.id);

  const indexEntry: AgentIndexEntry = {
    id: agent.id,
    name: agent.name,
    domain: agent.domain,
    role: agent.role,
    active: agent.active ?? true,
    created_at: agent._runtime.created_at || new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    index.agents[existingIndex] = indexEntry;
  } else {
    index.agents.push(indexEntry);
  }

  await writeAgentIndex(index);
}

/**
 * Delete an agent from storage
 */
export async function deleteAgent(agentId: string): Promise<boolean> {
  await ensureAgentsDir();

  const agentPath = join(AGENTS_DIR, `${agentId}.json`);

  if (!existsSync(agentPath)) {
    return false;
  }

  await unlink(agentPath);

  const index = await readAgentIndex();
  index.agents = index.agents.filter(a => a.id !== agentId);
  await writeAgentIndex(index);

  return true;
}

/**
 * List all agents in storage
 */
export async function listAgents(): Promise<AgentIndexEntry[]> {
  await ensureAgentsDir();
  const index = await readAgentIndex();
  return index.agents;
}

/**
 * List agents by domain
 */
export async function listAgentsByDomain(domain: string): Promise<AgentIndexEntry[]> {
  const agents = await listAgents();
  return agents.filter(a => a.domain === domain);
}

/**
 * Backup an agent before editing
 */
export async function backupAgent(agentId: string): Promise<string | null> {
  await ensureAgentsDir();

  const agentPath = join(AGENTS_DIR, `${agentId}.json`);

  if (!existsSync(agentPath)) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUPS_DIR, `${agentId}-${timestamp}.json`);

  await copyFile(agentPath, backupPath);

  return backupPath;
}

/**
 * Check if an agent exists
 */
export async function agentExists(agentId: string): Promise<boolean> {
  await ensureAgentsDir();
  const agentPath = join(AGENTS_DIR, `${agentId}.json`);
  return existsSync(agentPath);
}
