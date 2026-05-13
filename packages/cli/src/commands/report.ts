/**
 * Report commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function createReportCommands(): Command {
  const cmd = new Command('report');

  cmd
    .description('Report operations')
    .command('view <missionId>')
    .description('View mission report')
    .action(async (missionId) => {
      const missionsDir = join(homedir(), '.one4all', 'missions');
      const missionPath = join(missionsDir, `${missionId}.json`);

      if (!existsSync(missionPath)) {
        console.error(chalk.red(`❌ Mission not found: ${missionId}`));
        console.error(chalk.gray(`   Expected: ${missionPath}`));
        process.exit(1);
      }

      try {
        const mission = JSON.parse(readFileSync(missionPath, 'utf-8'));
        const stateData = mission.state_data || mission;

        console.log('');
        console.log(chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════'));
        console.log(chalk.bold.cyan('║') + `           MISSION REPORT: ${missionId.padEnd(24)}` + chalk.bold.cyan('║'));
        console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════'));
        console.log('');

        console.log(chalk.bold('📊 Mission Details:'));
        console.log(chalk.gray('━').repeat(63));
        console.log(`   ID:        ${chalk.cyan(mission.mission_id)}`);
        console.log(`   Ticker:    ${chalk.white(mission.ticker || 'N/A')}`);
        console.log(`   Domain:    ${chalk.white(mission.domain || 'N/A')}`);
        console.log(`   Type:      ${chalk.white(mission.mission_type || 'N/A')}`);
        console.log(`   State:     ${chalk.yellow(mission.state || 'UNKNOWN')}`);
        console.log(`   Created:   ${chalk.gray(mission.created_at || 'N/A')}`);
        if (mission.completed_at) {
          console.log(`   Completed: ${chalk.green(mission.completed_at)}`);
        }
        console.log('');

        // Show brief description
        if (mission.brief?.description) {
          console.log(chalk.bold('📝 Description:'));
          console.log(chalk.gray('━').repeat(63));
          console.log(`   ${mission.brief.description}`);
          console.log('');
        }

        // Show market data if available
        const marketData = {
          current_price: stateData.synthesis_output?.current_price,
          market_cap: stateData.synthesis_output?.market_cap,
          week_52_high: stateData.synthesis_output?.week_52_high,
          week_52_low: stateData.synthesis_output?.week_52_low,
          as_of_date: stateData.synthesis_output?.as_of_date,
        };

        if (marketData.current_price) {
          console.log(chalk.bold('💰 Market Data:'));
          console.log(chalk.gray('━').repeat(63));
          console.log(`   Current Price:    ${chalk.green('$' + marketData.current_price.toFixed(2))}`);
          if (marketData.week_52_high) {
            const range = `$${marketData.week_52_low?.toFixed(2) || 'N/A'} - $${marketData.week_52_high.toFixed(2)}`;
            console.log(`   52-Week Range:    ${chalk.cyan(range)}`);
          }
          if (marketData.market_cap) {
            console.log(`   Market Cap:        ${chalk.cyan(marketData.market_cap)}`);
          }
          if (marketData.as_of_date) {
            console.log(`   As Of:             ${chalk.gray(marketData.as_of_date)}`);
          }
          console.log('');
        }

        // Show evidence pack
        if (stateData.evidence_pack) {
          const ev = stateData.evidence_pack;
          console.log(chalk.bold('🔍 Evidence Summary:'));
          console.log(chalk.gray('━').repeat(63));
          console.log(`   Sources Found:     ${chalk.cyan(ev.sources_found.toString())}`);
          console.log(`   Evidence Score:    ${chalk.cyan(ev.evidence_score.toString() + '/100')}`);
          console.log(`   Tier 1 Sources:    ${chalk.cyan(ev.tier1_sources.toString())}`);
          if (ev.data_gaps && ev.data_gaps.length > 0) {
            console.log(`   Data Gaps:        ${chalk.yellow(ev.data_gaps.length.toString())}`);
          }
          console.log('');
        }

        // Show analyst outputs
        if (stateData.analyst_outputs) {
          console.log(chalk.bold('👥 Analyst Views:'));
          console.log(chalk.gray('━').repeat(63));
          for (const [agentId, output] of Object.entries(stateData.analyst_outputs)) {
            const analyst = output as any;
            console.log(`   ${chalk.bold.white(agentId)}`);
            if (analyst.fair_value !== undefined) {
              console.log(`   Fair Value:    ${chalk.green('$' + analyst.fair_value.toString())}`);
            }
            console.log(`   Conviction:    ${chalk.cyan((analyst.conviction_level || 0) + '/10')}`);
            if (analyst.view) {
              console.log(`   View:          ${chalk.gray(analyst.view.substring(0, 100) + '...')}`);
            }
            console.log('');
          }
        }

        // Show CIO decision
        const decision = stateData.decision || stateData.synthesis_output?.decision;
        if (decision) {
          console.log(chalk.bold('🎯 CIO Decision:'));
          console.log(chalk.gray('━').repeat(63));
          console.log(`   Decision:        ${chalk.bold.yellow(decision.decision_state)}`);
          console.log(`   Fair Value:      ${chalk.green('$' + decision.fair_value_conservative?.toString() || 'N/A')}`);
          console.log(`   Price to Watch:  ${chalk.cyan('$' + decision.price_to_watch?.toString() || 'N/A')}`);

          if (decision.thesis_breakers && decision.thesis_breakers.length > 0) {
            console.log('');
            console.log(`   ${chalk.bold.red('Thesis Breakers:')}`);
            for (const breaker of decision.thesis_breakers) {
              console.log(`   • ${chalk.gray(breaker)}`);
            }
          }

          if (decision.follow_up_events && decision.follow_up_events.length > 0) {
            console.log('');
            console.log(`   ${chalk.bold('Follow-up Events:')}`);
            for (const event of decision.follow_up_events) {
              console.log(`   • ${chalk.cyan(event.event)} (${chalk.gray(event.expected_date?.split('T')[0] || 'TBD')})`);
              console.log(`     Watch: ${chalk.gray(event.watch_for || 'N/A')}`);
            }
          }
          console.log('');
        }

        // Show consensus
        const consensus = stateData.synthesis_output?.consensus;
        if (consensus) {
          console.log(chalk.bold('💡 Consensus:'));
          console.log(chalk.gray('━').repeat(63));
          console.log(`   ${consensus}`);
          console.log('');
        }

        // Show synthesis if available (legacy format)
        if (mission.synthesis && !decision) {
          console.log(chalk.bold('🎯 Investment Recommendation:'));
          console.log(chalk.gray('━').repeat(63));
          console.log(mission.synthesis);
          console.log('');
        }

      } catch (error) {
        console.error(chalk.red(`❌ Error reading mission: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  return cmd;
}
