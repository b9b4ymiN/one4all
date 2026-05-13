#!/usr/bin/env node

/**
 * Mission Runner - Execute missions through full state machine
 * Takes a mission ID and runs it from current state to COMPLETED
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

const MISSIONS_DIR = join(homedir(), '.one4all', 'missions');

// Colors
const log = (msg) => console.log(msg);
const success = (msg) => console.log('\x1b[32m✅ ' + msg + '\x1b[0m');
const info = (msg) => console.log('\x1b[36mℹ️  ' + msg + '\x1b[0m');
const warn = (msg) => console.log('\x1b[33m⚠️  ' + msg + '\x1b[0m');
const error = (msg) => console.log('\x1b[31m❌ ' + msg + '\x1b[0m');

// Load mission from file
function loadMission(missionId) {
  const path = join(MISSIONS_DIR, `${missionId}.json`);
  if (!existsSync(path)) {
    throw new Error(`Mission not found: ${missionId}`);
  }
  const data = readFileSync(path, 'utf-8');
  return JSON.parse(data);
}

// Save mission to file
function saveMission(mission) {
  const path = join(MISSIONS_DIR, `${mission.mission_id}.json`);
  mission.updated_at = new Date().toISOString();
  writeFileSync(path, JSON.stringify(mission, null, 2));
}

// Call Gemini CLI
async function callGemini(prompt) {
  return new Promise((resolve, reject) => {
    const cmd = spawn('gemini', ['prompt', `"${prompt}"`, '--output-format', 'json'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    cmd.stdout.on('data', (d) => stdout += d.toString());
    cmd.stderr.on('data', () => {});
    cmd.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Gemini failed: ${code}`));
      try {
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.find(l => l.trim().startsWith('{'));
        if (jsonLine) {
          const parsed = JSON.parse(jsonLine);
          resolve(parsed.response || parsed.text || stdout);
        } else {
          resolve(stdout);
        }
      } catch (e) {
        resolve(stdout);
      }
    });
  });
}

// Call Claude CLI
async function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const cmd = spawn('claude', ['-p', `"${prompt}"`, '--output-format', 'json'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    cmd.stdout.on('data', (d) => stdout += d.toString());
    cmd.stderr.on('data', () => {});
    cmd.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Claude failed: ${code}`));
      try {
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.find(l => l.trim().startsWith('{'));
        if (jsonLine) {
          const parsed = JSON.parse(jsonLine);
          resolve(parsed.result || parsed.response || stdout);
        } else {
          resolve(stdout);
        }
      } catch (e) {
        resolve(stdout);
      }
    });
  });
}

// State: PLANNING → RESEARCHING
async function executePlanning(mission) {
  info('PLANNING Phase: Creating research plan...');

  const prompt = `คุณคือหัวหน้าทีมวิจัย สร้างแผนวิจัยสำหรับการวิเคราะห์หุ้น ${mission.ticker}

สิ่งที่ต้องวิจัย:
1. ข้อมูลพื้นฐานบริษัท
2. ฐานะการเงิน
3. จุดแข็ง/จุดอ่อน
4. ความเสี่ยง

ตอบเป็นภาษาไทย กระชับ`;

  const plan = await callGemini(prompt);
  mission.research_plan = plan;
  mission.state = 'RESEARCHING';
  saveMission(mission);
  success('Planning complete → RESEARCHING');
  return plan;
}

// State: RESEARCHING → DEBATING
async function executeResearching(mission) {
  info('RESEARCHING Phase: Gathering data...');

  const prompt = `คุณคือนักวิจัยพื้นฐานหลักทรัพย์ วิเคราะห์หุ้น ${mission.ticker} แบบละเอียด

1. ภาพรวมธุรกิจ
2. จุดแข็ง 3 ข้อ
3. ความเสี่ยง 3 ข้อ
4. ข้อมูลพื้นฐานสำคัญ

ตอบเป็นภาษาไทย`;

  const research = await callGemini(prompt);
  mission.research_data = research;
  mission.state = 'DEBATING';
  saveMission(mission);
  success('Research complete → DEBATING');
  return research;
}

// State: DEBATING → SYNTHESIS
async function executeDebating(mission) {
  info('DEBATING Phase: Valuation analysis...');

  const prompt = `คุณคือ Aswath Damodaran ผู้เชี่ยวชาญด้านการประเมินมูลค่าหุ้น

วิเคราะห์หุ้น ${mission.ticker} ด้วย DCF Valuation:

## ข้อมูลพื้นฐาน
| พารามิเตอร์ | ค่า |
|-------------|-----|
| P/E | 15x |
| DPS | 1.20 บาท |
| Growth (g) | 5% |
| Payout Ratio | 60% |

คำนวณ Gordon Growth: P = D₁ / (r - g)
ตอบเป็นภาษาไทย พร้อมสูตรคำนวณ`;

  const valuation = await callClaude(prompt);
  mission.valuation_data = valuation;
  mission.state = 'SYNTHESIS';
  saveMission(mission);
  success('Valuation complete → SYNTHESIS');
  return valuation;
}

// State: SYNTHESIS → COMPLETED
async function executeSynthesis(mission) {
  info('SYNTHESIS Phase: Creating final recommendation...');

  const prompt = `คุณคือหัวหน้าทีมลงทุน สรุปข้อมูลจากการวิจัยและการประเมินมูลค่าหุ้น ${mission.ticker}

## ข้อมูลที่มี:
- ผลวิจัย: ${mission.research_data?.substring(0, 200)}...
- ผลการประเมินมูลค่า: ${mission.valuation_data?.substring(0, 200)}...

## สรุป:
1. คำแนะนำ: BUY/HOLD/SELL
2. เหตุผลสนับสนุน 3 ข้อ
3. ข้อควรระวัง

ตอบเป็นภาษาไทย`;

  const synthesis = await callGemini(prompt);
  mission.synthesis = synthesis;
  mission.state = 'COMPLETED';
  mission.completed_at = new Date().toISOString();
  saveMission(mission);
  success('Synthesis complete → COMPLETED');
  return synthesis;
}

// Main execution flow
async function runMission(missionId) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║              MISSION EXECUTION: ${missionId.padEnd(23)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let mission = loadMission(missionId);
  const startState = mission.state;

  info(`Starting from state: ${startState}`);

  try {
    // Execute based on current state
    if (mission.state === 'PLANNING') {
      await executePlanning(mission);
    }
    if (mission.state === 'RESEARCHING') {
      await executeResearching(mission);
    }
    if (mission.state === 'DEBATING') {
      await executeDebating(mission);
    }
    if (mission.state === 'SYNTHESIS') {
      await executeSynthesis(mission);
    }

    // Show final results
    mission = loadMission(missionId); // Reload to get latest
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    MISSION COMPLETED                          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Final Recommendation:');
    console.log('━'.repeat(63));
    console.log(mission.synthesis || 'No synthesis available');
    console.log('\n');

    success(`Mission ${missionId} completed successfully!`);

  } catch (err) {
    error(`Mission failed: ${err.message}`);
    process.exit(1);
  }
}

// Get mission ID from args or use latest
const missionId = process.argv[2] || (() => {
  const files = require('fs').readdirSync(MISSIONS_DIR).filter(f => f.endsWith('.json'));
  const latest = files.sort().reverse()[0];
  return latest.replace('.json', '');
})();

runMission(missionId).catch(console.error);
