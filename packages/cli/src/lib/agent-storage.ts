/**
 * Agent Storage - Runtime agent management
 *
 * Handles storage and retrieval of agent configurations in ~/.one4all/agents/
 */

import { mkdir, readFile, writeFile, readdir, copyFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import type { RuntimeAgent, AgentIndexEntry } from './agent-schema.js';

const AGENTS_DIR = join(homedir(), '.one4all', 'agents');
const INDEX_FILE = join(AGENTS_DIR, '.index.json');
const BACKUPS_DIR = join(AGENTS_DIR, '.backups');

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

  // Ensure index file exists
  if (!existsSync(INDEX_FILE)) {
    await writeFile(INDEX_FILE, JSON.stringify({ agents: [], last_updated: new Date().toISOString() }, null, 2));
  }
}

/**
 * Read the agent index
 */
export async function readAgentIndex(): Promise<{ agents: AgentIndexEntry[]; last_updated: string }> {
  await ensureAgentsDir();

  try {
    const content = await readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Return empty index if file is corrupt
    return { agents: [], last_updated: new Date().toISOString() };
  }
}

/**
 * Write the agent index
 */
export async function writeAgentIndex(index: { agents: AgentIndexEntry[]; last_updated: string }): Promise<void> {
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
  } catch (error) {
    return null;
  }
}

/**
 * Write an agent to storage
 */
export async function writeAgent(agent: RuntimeAgent): Promise<void> {
  await ensureAgentsDir();

  const agentPath = join(AGENTS_DIR, `${agent.id}.json`);

  // Update runtime metadata
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
    provider: agent.model.primary.provider,
    active: agent.active ?? true,
    source_path: agent._runtime.source_path,
    imported_at: agent._runtime.imported_at,
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

  // Update index
  const index = await readAgentIndex();
  index.agents = index.agents.filter(a => a.id !== agentId);
  await writeAgentIndex(index);

  return true;
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
 * List all agents in storage
 */
export async function listAgents(): Promise<AgentIndexEntry[]> {
  await ensureAgentsDir();

  const index = await readAgentIndex();
  return index.agents;
}

/**
 * List backup files for an agent
 */
export async function listAgentBackups(agentId: string): Promise<string[]> {
  await ensureAgentsDir();

  if (!existsSync(BACKUPS_DIR)) {
    return [];
  }

  const files = await readdir(BACKUPS_DIR);
  return files
    .filter(f => f.startsWith(`${agentId}-`) && f.endsWith('.json'))
    .map(f => join(BACKUPS_DIR, f));
}

/**
 * Get storage directory paths
 */
export function getStoragePaths() {
  return {
    agentsDir: AGENTS_DIR,
    indexFile: INDEX_FILE,
    backupsDir: BACKUPS_DIR,
  };
}
