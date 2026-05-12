#!/usr/bin/env node

/**
 * BBLK Multi-Agent Analysis
 *
 * Uses Gemini CLI for Research and Claude CLI for Damodaran Valuation
 * Real multi-agent collaboration with actual LLM CLI tools
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

async function callGeminiCLI(prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      'prompt',
      `"${prompt.replace(/"/g, '\\"')}"`,
      '--output-format',
      'json'
    ];

    log(colors.cyan, `🔮 Gemini CLI: "${prompt.substring(0, 50)}..."`);

    const child = spawn('gemini', args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse JSON output
        const lines = stdout.trim().split('\n');
        let jsonLine = lines.find(l => l.trim().startsWith('{'));

        if (jsonLine) {
          const parsed = JSON.parse(jsonLine);
          resolve(parsed.response || parsed.text || parsed.content || stdout);
        } else {
          resolve(stdout);
        }
      } catch (e) {
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function callClaudeCLI(prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      `"${prompt.replace(/"/g, '\\"')}"`,
      '--output-format',
      'json'
    ];

    log(colors.blue, `🤖 Claude CLI: "${prompt.substring(0, 50)}..."`);

    const child = spawn('claude', args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse JSON output
        const lines = stdout.trim().split('\n');
        let jsonLine = lines.find(l => l.trim().startsWith('{'));

        if (jsonLine) {
          const parsed = JSON.parse(jsonLine);
          resolve(parsed.result || parsed.response || parsed.content || stdout);
        } else {
          resolve(stdout);
        }
      } catch (e) {
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function runMultiAgentBBLKAnalysis() {
  const missionId = `BBLK-${Date.now()}`;
  const startTime = Date.now();

  console.log('\n' + colors.bright);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        CPF (Charoen Pokphand Foods) Multi-Agent Analysis');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(colors.reset);
  console.log(`\n📊 Mission: ${missionId}`);
  console.log(`📅 ${new Date().toLocaleString('th-TH')}\n`);

  // ============================================
  // AGENT 1: Gemini CLI - Research Analyst
  // ============================================
  console.log('━'.repeat(63));
  log(colors.cyan, '🤖 AGENT 1 (Gemini CLI - Research Analyst):');
  console.log('━'.repeat(63));

  const researchPrompt = `คุณคือนักวิจัยพื้นฐานหลักทรัพย์มืออาชีพ ชำนาญด้านการวิเคราะห์ธุรกิจอุตสาหกรรมอาหาร

กรุณาวิจัยและสรุปข้อมูลหุ้น BBLK (บมจ. กรุงเทพดุสิต โฮลดิ้ง) โดย:

1. ภาพรวมธุรกิจและจุดแข็ง
2. ความเสี่ยงที่ต้องระวัง
3. ข้อมูลพื้นฐานที่สำคัญ

ตอบเป็นภาษาไทย กระชับ ไม่เกิน 150 คำ`;

  try {
    const researchResult = await callGeminiCLI(researchPrompt);
    log(colors.green, researchResult);
  } catch (error) {
    log(colors.yellow, `❌ Gemini CLI Error: ${error.message}`);
  }

  console.log('\n');

  // ============================================
  // AGENT 2: Claude CLI - Damodaran Valuation
  // ============================================
  console.log('━'.repeat(63));
  log(colors.blue, '📈 AGENT 2 (Claude CLI - Valuation Expert):');
  console.log('━'.repeat(63));

  const valuationPrompt = `คุณคือ Aswath Damodaran ผู้เชี่ยวชาญด้านการประเมินมูลค่าหุ้น (The Dean of Valuation)

กรุณาวิเคราะห์หุ้น BBLK (บมจ. กรุงเทพดุสิต โฮลดิ้ง) โดยใช้วิธี DCF Valuation:

## ข้อมูลพื้นฐาน
| พารามิเตอร์ | ค่า |
|-------------|-----|
| P/E | 18.5x |
| DPS (ปัจจุบัน) | 0.80 บาท |
| Growth (g) | 4% |
| Payout Ratio | 50% |

## ขั้นตอนการคำนวณ
1. หา EPS จาก DPS และ Payout Ratio
2. กำหนด Required Return (r)
3. ใช้ Gordon Growth Formula: P = D₁ / (r - g)
4. เปรียบเทียบกับ Forward P/E

ตอบเป็นภาษาไทย พร้อมตารางสรุป Fair Value`;

  try {
    const valuationResult = await callClaudeCLI(valuationPrompt);
    log(colors.green, valuationResult);
  } catch (error) {
    log(colors.yellow, `❌ Claude CLI Error: ${error.message}`);
  }

  console.log('\n');

  // ============================================
  // SYNTHESIS
  // ============================================
  console.log('━'.repeat(63));
  log(colors.bright, '🎯 SYNTHESIS:');
  console.log('━'.repeat(63));

  const synthesisPrompt = `คุณคือหัวหน้าทีมวิจัยลงทุน โดยมีผลการวิเคราะห์จาก 2 Agent:

Agent 1 (Gemini): วิจัยข้อมูลพื้นฐาน BBLK
Agent 2 (Claude): วิเคราะห์ DCF Valuation มุมมองดาโมดารัน

กรุณาสังเคราะห์ (Synthesis) และให้คำแนะนำการลงทุนสำหรับ BBLK:
- BUY (ซื้อ) หรือ HOLD (ถือ) หรือ SELL (ขาย)
- เหตุผลสนับสนุน 2-3 ข้อ
- ข้อควรระวัง

ตอบเป็นภาษาไทย กระชับ`;

  try {
    const synthesisResult = await callGeminiCLI(synthesisPrompt);
    log(colors.bright, synthesisResult);
  } catch (error) {
    log(colors.yellow, `❌ Synthesis Error: ${error.message}`);
  }

  const duration = Date.now() - startTime;

  console.log('\n' + colors.bright);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Generated by: one4all Multi-Agent Kernel System');
  console.log('  Agents: Gemini CLI + Claude CLI');
  console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(colors.reset + '\n');
}

runMultiAgentBBLKAnalysis().catch(console.error);
