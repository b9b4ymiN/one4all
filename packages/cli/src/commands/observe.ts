/**
 * Observability Commands - Real-time monitoring and metrics
 *
 * observe: missions, agents, health with streaming output
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { table } from 'table';
import { listAgents } from '../lib/agent-storage.js';
import { listDomains } from '../lib/domain-storage.js';

const LOGS_DIR = join(homedir(), '.one4all', 'logs');
const MISSIONS_DIR = join(homedir(), '.one4all', 'missions');

export function createObserveCommands(): Command {
  const cmd = new Command('observe');

  cmd.description('Real-time observability (missions, agents, health)');

  // === OBSERVE MISSION ===
  cmd
    .command('mission <missionId>')
    .description('Observe mission progress in real-time')
    .option('-f, --follow', 'Follow mission progress (streaming)')
    .option('-n, --lines <n>', 'Number of lines to show', '50')
    .action(async (missionId, options) => {
      await observeMission(missionId, options);
    });

  // === OBSERVE AGENTS ===
  cmd
    .command('agents')
    .description('Observe agent performance and status')
    .option('-d, --domain <domain>', 'Filter by domain')
    .option('--active-only', 'Show only active agents')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      await observeAgents(options);
    });

  // === HEALTH CHECK ===
  cmd
    .command('health')
    .description('Check system health (providers, storage, configs)')
    .option('-v, --verbose', 'Verbose output')
    .action(async (options) => {
      await checkHealth(options);
    });

  // === LOGS ===
  cmd
    .command('logs')
    .description('View system logs')
    .option('-n, --lines <n>', 'Number of lines to show', '100')
    .option('-f, --follow', 'Follow log output')
    .option('--level <level>', 'Filter by level (error, warn, info, debug)')
    .action(async (options) => {
      await viewLogs(options);
    });

  // === EXPORT METRICS ===
  cmd
    .command('export')
    .description('Export metrics to file')
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (json, csv)', 'json')
    .action(async (options) => {
      await exportMetrics(options);
    });

  return cmd;
}

// === OBSERVE MISSION ===

async function observeMission(missionId: string, options: any): Promise<void> {
  const missionPath = join(MISSIONS_DIR, `${missionId}.json`);

  if (!existsSync(missionPath)) {
    console.error(chalk.red(`Error: Mission "${missionId}" not found`));
    console.log(chalk.dim(`Looking in: ${MISSIONS_DIR}`));
    process.exit(1);
  }

  const mission = JSON.parse(await readFile(missionPath, 'utf-8'));

  console.log(chalk.cyan(`Mission: ${mission.brief?.description || missionId}`));
  console.log(chalk.dim(`ID: ${mission.id}`));
  console.log(chalk.dim(`State: ${mission.state}`));
  console.log(chalk.dim(`Created: ${mission.created_at}`));

  // Show state transitions
  if (mission.state_history && mission.state_history.length > 0) {
    console.log(chalk.cyan('\nState History:'));
    const historyData = [
      ['State', 'Entered At', 'Duration'],
    ];

    for (let i = 0; i < mission.state_history.length; i++) {
      const h = mission.state_history[i];
      const duration = h.duration_ms ? `${Math.round(h.duration_ms / 1000)}s` : '-';
      historyData.push([h.state, new Date(h.entered_at).toLocaleTimeString(), duration]);
    }

    console.log(table(historyData));
  }

  // Show analyst results if available
  if (mission.analyst_results && Object.keys(mission.analyst_results).length > 0) {
    console.log(chalk.cyan('\nAnalyst Results:'));
    const resultData = [
      ['Agent', 'Status', 'Tokens', 'Duration'],
    ];

    for (const [agentId, result] of Object.entries(mission.analyst_results) as any) {
      const status = result.success ? chalk.green('✓') : chalk.red('✗');
      const tokens = result.tokens_used?.total || '-';
      const duration = result.timing?.duration_ms ? `${Math.round(result.timing.duration_ms / 1000)}s` : '-';
      resultData.push([agentId, status, String(tokens), duration]);
    }

    console.log(table(resultData));
  }

  // Follow mode
  if (options.follow) {
    console.log(chalk.dim('\nFollowing mission progress (Ctrl+C to stop)...'));
    console.log(chalk.dim('Note: Real-time following requires active mission execution'));

    // Poll for changes
    let lastModified = (await stat(missionPath)).mtime.getTime();
    const interval = setInterval(async () => {
      try {
        const newStat = await stat(missionPath);
        if (newStat.mtime.getTime() > lastModified) {
          lastModified = newStat.mtime.getTime();
          const updatedMission = JSON.parse(await readFile(missionPath, 'utf-8'));

          // Show new state
          console.log(chalk.dim(`\n[${new Date().toLocaleTimeString()}] State: ${updatedMission.state}`));

          // Show any new analyst results
          if (updatedMission.analyst_results) {
            for (const [agentId, result] of Object.entries(updatedMission.analyst_results) as any) {
              if ((result as any).updated_at > lastModified - 5000) {
                const status = (result as any).success ? chalk.green('✓') : chalk.red('✗');
                console.log(chalk.dim(`  ${agentId}: ${status}`));
              }
            }
          }
        }
      } catch (error) {
        // Mission might have been deleted
        clearInterval(interval);
        console.log(chalk.yellow('\nMission file no longer accessible'));
      }
    }, 2000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.dim('\nStopped following'));
      process.exit(0);
    });
  }
}

// === OBSERVE AGENTS ===

async function observeAgents(options: any): Promise<void> {
  // Import agent storage functions
  const { listAgents } = await import('../lib/agent-storage.js');

  let agents = await listAgents();

  // Apply filters
  if (options.domain) {
    agents = agents.filter(a => a.domain === options.domain);
  }
  if (options.activeOnly) {
    agents = agents.filter(a => a.active);
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }

  if (agents.length === 0) {
    console.log(chalk.yellow('No agents found'));
    return;
  }

  // Table format
  const data = [
    ['ID', 'Name', 'Domain', 'Role', 'Provider', 'Active', 'Last Modified'],
  ];

  for (const agent of agents) {
    const lastModified = new Date(agent.imported_at || Date.now()).toLocaleDateString();
    data.push([
      agent.id,
      agent.name.substring(0, 25),
      agent.domain.substring(0, 15),
      agent.role.substring(0, 15),
      agent.provider,
      agent.active ? '✓' : '✗',
      lastModified,
    ]);
  }

  console.log(table(data));
  console.log(chalk.dim(`\nTotal: ${agents.length} agents`));
}

// === HEALTH CHECK ===

async function checkHealth(options: any): Promise<void> {
  console.log(chalk.cyan('System Health Check'));
  console.log(chalk.dim('='.repeat(40)));

  const healthChecks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    details?: string;
  }> = [];

  // Check storage directories
  const dirs = [
    { name: 'Missions', path: MISSIONS_DIR },
    { name: 'Logs', path: LOGS_DIR },
    { name: 'Agents', path: join(homedir(), '.one4all', 'agents') },
    { name: 'Domains', path: join(homedir(), '.one4all', 'domains') },
  ];

  for (const dir of dirs) {
    if (existsSync(dir.path)) {
      const stats = await readdir(dir.path);
      healthChecks.push({
        name: dir.name,
        status: 'pass',
        message: `Accessible (${stats.length} items)`,
        details: dir.path,
      });
    } else {
      healthChecks.push({
        name: dir.name,
        status: 'warn',
        message: 'Not found (will be created on first use)',
        details: dir.path,
      });
    }
  }

  // Check CLI tools availability
  const cliTools = [
    { name: 'Gemini CLI', command: 'gemini', versionFlag: '--version' },
    { name: 'Claude CLI', command: 'claude', versionFlag: '--version' },
  ];

  for (const tool of cliTools) {
    try {
      const { execSync } = await import('child_process');
      execSync(`${tool.command} ${tool.versionFlag}`, { stdio: 'ignore' });
      healthChecks.push({
        name: tool.name,
        status: 'pass',
        message: 'Installed and accessible',
      });
    } catch {
      healthChecks.push({
        name: tool.name,
        status: 'warn',
        message: 'Not found or not in PATH',
      });
    }
  }

  // Check environment variables
  const envVars = ['ZAI_API_KEY'];
  for (const envVar of envVars) {
    if (process.env[envVar]) {
      healthChecks.push({
        name: `${envVar} (hidden)`,
        status: 'pass',
        message: 'Set',
      });
    } else {
      healthChecks.push({
        name: envVar,
        status: 'warn',
        message: 'Not set',
      });
    }
  }

  // Display results
  for (const check of healthChecks) {
    const status = check.status === 'pass' ? chalk.green('✓') :
                   check.status === 'fail' ? chalk.red('✗') :
                   chalk.yellow('⚠');
    console.log(`${status} ${chalk.bold(check.name)}: ${check.message}`);
    if (options.verbose && check.details) {
      console.log(chalk.dim(`  ${check.details}`));
    }
  }

  // Summary
  const passes = healthChecks.filter(h => h.status === 'pass').length;
  const fails = healthChecks.filter(h => h.status === 'fail').length;
  const warns = healthChecks.filter(h => h.status === 'warn').length;

  console.log(chalk.dim('\n' + '='.repeat(40)));
  console.log(chalk.dim(`Passed: ${passes}, Warnings: ${warns}, Failed: ${fails}`));

  if (fails > 0) {
    process.exit(1);
  }
}

// === VIEW LOGS ===

async function viewLogs(options: any): Promise<void> {
  if (!existsSync(LOGS_DIR)) {
    console.log(chalk.yellow('No logs directory found'));
    return;
  }

  const logFiles = await readdir(LOGS_DIR);
  const latestLog = logFiles
    .filter(f => f.endsWith('.log'))
    .sort()
    .reverse()[0];

  if (!latestLog) {
    console.log(chalk.yellow('No log files found'));
    return;
  }

  const logPath = join(LOGS_DIR, latestLog);

  if (options.follow) {
    console.log(chalk.cyan(`Following ${latestLog} (Ctrl+C to stop)...`));

    const { spawn } = await import('child_process');
    const tail = spawn('tail', ['-n', options.lines, '-f', logPath]);

    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line) continue;

        // Colorize by level
        if (line.includes('ERROR')) console.log(chalk.red(line));
        else if (line.includes('WARN')) console.log(chalk.yellow(line));
        else if (line.includes('DEBUG')) console.log(chalk.dim(line));
        else console.log(line);
      }
    });

    tail.on('error', () => {
      console.log(chalk.yellow('tail command not available, showing static log'));
      options.follow = false;
    });
  } else {
    const content = await readFile(logPath, 'utf-8');
    const lines = content.split('\n');
    const numLines = parseInt(options.lines, 10);
    const showLines = lines.slice(-numLines);

    for (const line of showLines) {
      if (!line) continue;

      // Filter by level if specified
      if (options.level) {
        const levelUpper = options.level.toUpperCase();
        if (!line.includes(levelUpper)) continue;
      }

      // Colorize by level
      if (line.includes('ERROR')) console.log(chalk.red(line));
      else if (line.includes('WARN')) console.log(chalk.yellow(line));
      else if (line.includes('DEBUG')) console.log(chalk.dim(line));
      else console.log(line);
    }
  }
}

// === EXPORT METRICS ===

async function exportMetrics(options: any): Promise<void> {
  // Gather metrics from all sources
  const agents = await listAgents();
  const domains = await listDomains();

  const metrics = {
    generated_at: new Date().toISOString(),
    agents: {
      total: agents.length,
      active: agents.filter(a => a.active).length,
      by_domain: agents.reduce((acc, a) => {
        acc[a.domain] = (acc[a.domain] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      by_provider: agents.reduce((acc, a) => {
        acc[a.provider] = (acc[a.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
    domains: {
      total: domains.length,
      with_constitution: domains.filter(d => d.constitution_loaded).length,
    },
    missions: {
      total: 0, // Would count from missions directory
      by_state: {} as Record<string, number>,
    },
  };

  // Count missions
  if (existsSync(MISSIONS_DIR)) {
    const missionFiles = await readdir(MISSIONS_DIR);
    metrics.missions.total = missionFiles.filter(f => f.endsWith('.json')).length;

    for (const file of missionFiles) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(MISSIONS_DIR, file), 'utf-8');
        const mission = JSON.parse(content);
        metrics.missions.by_state[mission.state] = (metrics.missions.by_state[mission.state] || 0) + 1;
      } catch {
        // Skip invalid mission files
      }
    }
  }

  if (options.format === 'csv') {
    // Convert to CSV
    let csv = 'Category,Metric,Value\n';
    csv += `agents,total,${metrics.agents.total}\n`;
    csv += `agents,active,${metrics.agents.active}\n`;
    csv += `domains,total,${metrics.domains.total}\n`;
    csv += `missions,total,${metrics.missions.total}\n`;

    if (options.output) {
      await writeFile(options.output, csv);
      console.log(chalk.green(`✓ Metrics exported to ${options.output}`));
    } else {
      console.log(csv);
    }
  } else {
    const json = JSON.stringify(metrics, null, 2);

    if (options.output) {
      await writeFile(options.output, json);
      console.log(chalk.green(`✓ Metrics exported to ${options.output}`));
    } else {
      console.log(json);
    }
  }
}
