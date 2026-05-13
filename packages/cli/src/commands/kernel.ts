/**
 * Kernel commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

export function createKernelCommands(): Command {
  const cmd = new Command('kernel');

  cmd
    .description('Kernel operations and status')
    .command('status')
    .description('Show system health status')
    .action(async () => {
      console.log('');
      console.log(chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════'));
      console.log(chalk.bold.cyan('║') + '            ONE4ALL KERNEL STATUS REPORT' + ' '.repeat(19) + chalk.bold.cyan('║'));
      console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════'));
      console.log('');

      // CLI Tools Check
      console.log(chalk.bold('🤖 CLI Tools Available:'));
      console.log(chalk.gray('━').repeat(63));

      const cliTools = [
        { name: 'gemini', check: () => { try { execSync('which gemini'); return true; } catch { return false; } } },
        { name: 'codex', check: () => { try { execSync('which codex'); return true; } catch { return false; } } },
        { name: 'claude', check: () => { try { execSync('which claude'); return true; } catch { return false; } } },
      ];

      for (const tool of cliTools) {
        const available = tool.check();
        if (available) {
          try {
            const version = execSync(`${tool.name} --version`, { encoding: 'utf-8' }).trim();
            console.log(chalk.green('   ✅') + ` ${tool.name}: ${chalk.white(version)}`);
          } catch {
            console.log(chalk.green('   ✅') + ` ${tool.name}: ${chalk.white('installed')}`);
          }
        } else {
          console.log(chalk.red('   ❌') + ` ${tool.name}: ${chalk.gray('not installed')}`);
        }
      }
      console.log('');

      // Recent Missions
      console.log(chalk.bold('📊 Recent Missions:'));
      console.log(chalk.gray('━').repeat(63));

      const missionsDir = join(homedir(), '.one4all', 'missions');
      if (existsSync(missionsDir)) {
        const files = readdirSync(missionsDir)
          .filter(f => f.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, 5);

        if (files.length === 0) {
          console.log(chalk.gray('   No missions found'));
        } else {
          for (const file of files) {
            try {
              const content = JSON.parse(
                readFileSync(join(missionsDir, file), 'utf-8')
              );
              const state = content.state || 'UNKNOWN';
              const ticker = content.ticker || 'N/A';
              const name = file.replace('.json', '');
              console.log(`   • ${chalk.cyan(name)} - ${chalk.white(ticker)} [${state}]`);
            } catch {
              console.log(`   • ${chalk.gray(file.replace('.json', ''))} - ${chalk.red('[error reading]')}`);
            }
          }
        }
      } else {
        console.log(chalk.gray('   No missions directory found'));
      }
      console.log('');

      // System Status
      console.log(chalk.bold('📦 System Status:'));
      console.log(chalk.gray('━').repeat(63));
      console.log(`   Kernel: ${chalk.green('✅ Online')}`);
      console.log(`   Missions Directory: ${existsSync(missionsDir) ? chalk.green('✅') : chalk.yellow('⚠️')} ${missionsDir}`);
      console.log('');
    });

  return cmd;
}
