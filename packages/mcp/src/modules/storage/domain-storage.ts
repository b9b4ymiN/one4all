/**
 * MCP Domain Storage
 *
 * Simplified domain storage for MCP server.
 * Stores domain configurations in ~/.one4all/domains/
 */

import { mkdir, readFile, writeFile, readdir, copyFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

const DOMAINS_DIR = join(homedir(), '.one4all', 'domains');
const INDEX_FILE = join(DOMAINS_DIR, '.index.json');
const BACKUPS_DIR = join(DOMAINS_DIR, '.backups');

export interface DomainIndexEntry {
  id: string;
  name: string;
  description?: string;
  agent_count?: number;
  constitution_loaded?: boolean;
  created_at: string;
}

export interface RuntimeDomain {
  id: string;
  name: string;
  description?: string;
  agent_ids?: string[];
  constitution_path?: string;
  _runtime: {
    source_path?: string;
    created_at: string;
    last_modified: string;
    constitution_rules?: number;
  };
}

export interface DomainIndex {
  domains: DomainIndexEntry[];
  last_updated: string;
}

/**
 * Ensure the domains directory structure exists
 */
export async function ensureDomainsDir(): Promise<void> {
  const dirs = [DOMAINS_DIR, BACKUPS_DIR];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  if (!existsSync(INDEX_FILE)) {
    await writeFile(INDEX_FILE, JSON.stringify({ domains: [], last_updated: new Date().toISOString() }, null, 2));
  }
}

/**
 * Read the domain index
 */
export async function readDomainIndex(): Promise<DomainIndex> {
  await ensureDomainsDir();

  try {
    const content = await readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { domains: [], last_updated: new Date().toISOString() };
  }
}

/**
 * Write the domain index
 */
export async function writeDomainIndex(index: DomainIndex): Promise<void> {
  await ensureDomainsDir();
  index.last_updated = new Date().toISOString();
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Read a domain from storage
 */
export async function readDomain(domainId: string): Promise<RuntimeDomain | null> {
  await ensureDomainsDir();

  const domainPath = join(DOMAINS_DIR, `${domainId}.json`);

  try {
    const content = await readFile(domainPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write a domain to storage
 */
export async function writeDomain(domain: RuntimeDomain): Promise<void> {
  await ensureDomainsDir();

  const domainPath = join(DOMAINS_DIR, `${domain.id}.json`);

  domain._runtime.last_modified = new Date().toISOString();

  await writeFile(domainPath, JSON.stringify(domain, null, 2));

  await updateDomainIndex(domain);
}

/**
 * Update domain index entry
 */
async function updateDomainIndex(domain: RuntimeDomain): Promise<void> {
  const index = await readDomainIndex();

  const existingIndex = index.domains.findIndex(d => d.id === domain.id);

  const indexEntry: DomainIndexEntry = {
    id: domain.id,
    name: domain.name,
    description: domain.description,
    agent_count: domain.agent_ids?.length || 0,
    constitution_loaded: (domain._runtime.constitution_rules || 0) > 0,
    created_at: domain._runtime.created_at,
  };

  if (existingIndex >= 0) {
    index.domains[existingIndex] = indexEntry;
  } else {
    index.domains.push(indexEntry);
  }

  await writeDomainIndex(index);
}

/**
 * Delete a domain from storage
 */
export async function deleteDomain(domainId: string): Promise<boolean> {
  await ensureDomainsDir();

  const domainPath = join(DOMAINS_DIR, `${domainId}.json`);

  if (!existsSync(domainPath)) {
    return false;
  }

  await unlink(domainPath);

  const index = await readDomainIndex();
  index.domains = index.domains.filter(d => d.id !== domainId);
  await writeDomainIndex(index);

  return true;
}

/**
 * List all domains in storage
 */
export async function listDomains(): Promise<DomainIndexEntry[]> {
  await ensureDomainsDir();
  const index = await readDomainIndex();
  return index.domains;
}

/**
 * Backup a domain before editing
 */
export async function backupDomain(domainId: string): Promise<string | null> {
  await ensureDomainsDir();

  const domainPath = join(DOMAINS_DIR, `${domainId}.json`);

  if (!existsSync(domainPath)) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUPS_DIR, `${domainId}-${timestamp}.json`);

  await copyFile(domainPath, backupPath);

  return backupPath;
}

/**
 * Check if a domain exists
 */
export async function domainExists(domainId: string): Promise<boolean> {
  await ensureDomainsDir();
  const domainPath = join(DOMAINS_DIR, `${domainId}.json`);
  return existsSync(domainPath);
}

/**
 * Validate domain configuration
 */
export async function validateDomain(domainId: string): Promise<{ valid: boolean; errors: string[] }> {
  const domain = await readDomain(domainId);

  if (!domain) {
    return { valid: false, errors: ['Domain not found'] };
  }

  const errors: string[] = [];

  if (!domain.id || domain.id.trim() === '') {
    errors.push('Domain ID is required');
  }

  if (!domain.name || domain.name.trim() === '') {
    errors.push('Domain name is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
