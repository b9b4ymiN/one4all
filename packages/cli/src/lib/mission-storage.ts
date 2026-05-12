/**
 * Mission Storage
 *
 * File-based persistence for missions in ~/.one4all/missions/
 */

import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface StoredMission {
  mission_id: string;
  state: string;
  created_at: string;
  updated_at: string;
  domain: string;
  mission_type: string;
  ticker?: string;
  brief?: {
    type: string;
    domain: string;
    ticker?: string;
    description: string;
    owner_assumptions?: Record<string, unknown>;
    constraints?: Record<string, unknown>;
  };
}

export class MissionStorage {
  private storagePath: string;

  constructor() {
    this.storagePath = join(homedir(), '.one4all', 'missions');
  }

  async init(): Promise<void> {
    if (!existsSync(this.storagePath)) {
      await mkdir(this.storagePath, { recursive: true });
    }
  }

  async save(mission: StoredMission): Promise<void> {
    await this.init();
    const filePath = join(this.storagePath, `${mission.mission_id}.json`);
    await writeFile(filePath, JSON.stringify(mission, null, 2), 'utf-8');
  }

  async load(missionId: string): Promise<StoredMission | null> {
    await this.init();
    const filePath = join(this.storagePath, `${missionId}.json`);

    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as StoredMission;
    } catch {
      return null;
    }
  }

  async list(): Promise<StoredMission[]> {
    await this.init();

    try {
      const files = await readdir(this.storagePath);
      const missions: StoredMission[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.storagePath, file);
          const data = await readFile(filePath, 'utf-8');
          missions.push(JSON.parse(data) as StoredMission);
        }
      }

      return missions.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch {
      return [];
    }
  }

  async delete(missionId: string): Promise<boolean> {
    await this.init();
    const filePath = join(this.storagePath, `${missionId}.json`);

    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getPath(): string {
    return this.storagePath;
  }
}

// Singleton instance
let storageInstance: MissionStorage | null = null;

export function getMissionStorage(): MissionStorage {
  if (!storageInstance) {
    storageInstance = new MissionStorage();
  }
  return storageInstance;
}
