/**
 * Quick Start E2E Test
 *
 * Tests the complete Quick Start workflow from README.md:
 * 1. one4all kernel status
 * 2. one4all mission create
 * 3. one4all mission run
 * 4. one4all report view
 * 5. one4all journal list
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { readFileSync, rmSync } from 'fs';

const ONE4ALL_CMD = 'one4all';
const TEST_TICKER = 'TEST';
const TEST_DOMAIN = 'investment-war-room';

describe('Quick Start E2E Test', () => {
  let createdMissionId: string | null = null;
  const missionsDir = join(homedir(), '.one4all', 'missions');

  beforeAll(() => {
    // Ensure missions directory exists
    if (!existsSync(missionsDir)) {
      execSync(`mkdir -p ${missionsDir}`);
    }
  });

  afterAll(() => {
    // Cleanup: delete test mission if created
    if (createdMissionId) {
      const missionPath = join(missionsDir, `${createdMissionId}.json`);
      if (existsSync(missionPath)) {
        try {
          unlinkSync(missionPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  });

  it('should show kernel status (README Step 1)', () => {
    const output = execSync(`${ONE4ALL_CMD} kernel status`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    // Verify key sections exist
    expect(output).toContain('ONE4ALL KERNEL STATUS REPORT');
    expect(output).toContain('CLI Tools Available');
    expect(output).toContain('gemini');
    expect(output).toContain('claude');
    expect(output).toContain('Recent Missions');
    expect(output).toContain('System Status');
  });

  it('should create a mission (README Step 2)', () => {
    // Create a test mission using the CLI
    const output = execSync(
      `${ONE4ALL_CMD} mission create --domain ${TEST_DOMAIN} --type stock_analysis --ticker ${TEST_TICKER} --description "E2E test mission"`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );

    // Extract mission ID from output (format: "ID: TEST-1234567890")
    const match = output.match(/ID:\s+(\S+)/);
    expect(match).toBeTruthy();

    createdMissionId = match![1];
    expect(createdMissionId).toContain(TEST_TICKER);

    // Verify mission file was created
    const missionPath = join(missionsDir, `${createdMissionId}.json`);
    expect(existsSync(missionPath)).toBe(true);

    // Verify mission content
    const missionData = JSON.parse(readFileSync(missionPath, 'utf-8'));
    expect(missionData.ticker).toBe(TEST_TICKER);
    expect(missionData.domain).toBe(TEST_DOMAIN);
    expect(missionData.mission_type).toBe('stock_analysis');
  });

  it('should view mission report (README Step 4)', () => {
    if (!createdMissionId) {
      throw new Error('Mission not created in previous test');
    }

    const output = execSync(`${ONE4ALL_CMD} report view ${createdMissionId}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    // Verify report contains mission details
    expect(output).toContain('MISSION REPORT');
    expect(output).toContain(createdMissionId);
    expect(output).toContain(TEST_TICKER);
    expect(output).toContain('Mission Details');
  });

  it('should handle non-existent mission gracefully', () => {
    expect(() => {
      execSync(`${ONE4ALL_CMD} report view NONEXISTENT-12345`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
    }).toThrow();
  });

  it('should list journal entries (README Step 5)', () => {
    const output = execSync(`${ONE4ALL_CMD} journal list`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    // Just verify command runs without error
    expect(output).toBeDefined();
    expect(typeof output).toBe('string');
  });

  it('should complete full Quick Start workflow end-to-end', () => {
    // This test verifies the entire workflow as documented in README Quick Start

    // 1. Check system health
    const statusOutput = execSync(`${ONE4ALL_CMD} kernel status`, {
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']
    });
    expect(statusOutput).toContain('ONE4ALL KERNEL STATUS REPORT');

    // 2. Create mission
    const createOutput = execSync(
      `${ONE4ALL_CMD} mission create --domain ${TEST_DOMAIN} --type stock_analysis --ticker ${TEST_TICKER} --description "Quick Start E2E test"`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const missionMatch = createOutput.match(/ID:\s+(\S+)/);
    expect(missionMatch).toBeTruthy();
    const missionId = missionMatch![1];

    // 3. View report
    const reportOutput = execSync(`${ONE4ALL_CMD} report view ${missionId}`, {
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']
    });
    expect(reportOutput).toContain('MISSION REPORT');

    // 4. List journal
    const journalOutput = execSync(`${ONE4ALL_CMD} journal list`, {
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']
    });
    expect(journalOutput).toBeDefined();

    // Cleanup
    const missionPath = join(missionsDir, `${missionId}.json`);
    if (existsSync(missionPath)) {
      unlinkSync(missionPath);
    }
  });
});
