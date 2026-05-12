/**
 * Format utilities for CLI output
 */

import chalk from 'chalk';
import Table from 'cli-table3';

export interface FormatOptions {
  compact?: boolean;
  color?: boolean;
}

/**
 * Format a mission state with color
 */
export function formatState(state: string): string {
  const stateColors: Record<string, (text: string) => string> = {
    DRAFT: chalk.gray,
    PLANNING: chalk.blue,
    RESEARCHING: chalk.cyan,
    ANALYZING: chalk.yellow,
    CROSS_QA: chalk.magenta,
    DEBATING: chalk.magenta,
    SYNTHESIZING: chalk.yellow,
    HUMAN_REVIEW: chalk.dim,
    HUMAN_REVIEW_GATE_1: chalk.dim,
    HUMAN_REVIEW_GATE_2: chalk.dim,
    HUMAN_REVIEW_GATE_3: chalk.dim,
    DECIDED: chalk.green,
    JOURNALED: chalk.green,
    FAILED: chalk.red,
  };

  const colorFn = stateColors[state] || chalk.white;
  return colorFn(state);
}

/**
 * Format a decision state with color
 */
export function formatDecisionState(state: string): string {
  const positiveStates = ['HOLD', 'STARTER_POSITION', 'CORE_CANDIDATE'];
  const negativeStates = ['REJECT', 'WATCH', 'EXIT_THESIS_BROKEN'];
  const neutralStates = ['TRIM', 'ADD_ON_WEAKNESS', 'WAIT_FOR_PRICE'];
  const pendingStates = ['RESEARCH_MORE'];

  if (positiveStates.includes(state)) {
    return chalk.green(state);
  }
  if (negativeStates.includes(state)) {
    return chalk.red(state);
  }
  if (neutralStates.includes(state)) {
    return chalk.yellow(state);
  }
  if (pendingStates.includes(state)) {
    return chalk.blue(state);
  }
  return chalk.white(state);
}

/**
 * Format a timestamp
 */
export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

/**
 * Format a duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format a number with precision
 */
export function formatNumber(value: number, precision: number = 2): string {
  return value.toFixed(precision);
}

/**
 * Format a currency value
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Create a table for output
 */
export function createTable(headers: string[]): any {
  const table = new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: {
      head: [],
      border: ['gray'],
    },
  } as any);
  return table;
}

/**
 * Add a row to a table
 */
export function addTableRow(table: any, row: string[]): void {
  (table as any).push(row);
}

/**
 * Format a health check result
 */
export function formatHealth(name: string, status: 'online' | 'offline' | 'degraded', details?: string): string {
  let icon: string;
  let statusText: string;

  if (status === 'online') {
    icon = chalk.green('✓');
    statusText = chalk.green('online');
  } else if (status === 'degraded') {
    icon = chalk.yellow('⚠');
    statusText = chalk.yellow('degraded');
  } else {
    icon = chalk.red('✗');
    statusText = chalk.red('OFFLINE');
  }

  const detailsStr = details ? chalk.dim(` | ${details}`) : '';
  return `${icon} ${chalk.white(name)}: ${statusText}${detailsStr}`;
}

/**
 * Format an evidence tier
 */
export function formatEvidenceTier(tier: number): string {
  const tierColors: Record<number, (text: string) => string> = {
    1: chalk.green,
    2: chalk.blue,
    3: chalk.yellow,
    4: chalk.hex('#FFA500'), // orange
    5: chalk.red,
  };
  const colorFn = tierColors[tier] || chalk.white;
  return colorFn(`Tier ${tier}`);
}

/**
 * Format an enforcement level
 */
export function formatEnforcementLevel(level: string): string {
  const levelColors: Record<string, (text: string) => string> = {
    BLOCK_MISSION: chalk.red,
    INSERT_HUMAN_REVIEW: chalk.yellow,
    WARN_AND_FLAG: chalk.blue,
    REJECT_OUTPUT: chalk.magenta,
  };
  const colorFn = levelColors[level] || chalk.white;
  return colorFn(level);
}

/**
 * Print a success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Print an error message
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * Print a warning message
 */
export function warning(message: string): void {
  console.warn(chalk.yellow('⚠'), message);
}

/**
 * Print an info message
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Print a section header
 */
export function header(title: string): void {
  console.log('\n' + chalk.bold.cyan(`=== ${title} ===`));
}

/**
 * Print a key-value pair
 */
export function kv(key: string, value: string): void {
  console.log(`${chalk.cyan(key)}: ${value}`);
}
