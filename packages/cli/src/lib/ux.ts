/**
 * Professional UX - Enhanced errors, help, and progress indicators
 *
 * Provides user-friendly error messages with suggestions,
 * contextual help with examples, and progress indicators
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { existsSync } from 'fs';
import { join } from 'path';

// === ENHANCED ERROR HANDLER ===

export interface ErrorContext {
  command?: string;
  args?: Record<string, any>;
  cause?: Error;
  suggestions?: string[];
}

export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Enhanced error handler with actionable suggestions
 */
export function handleError(error: unknown, context?: ErrorContext): never {
  console.error('\n' + chalk.red('✗ Error: '));

  if (error instanceof CLIError) {
    console.error(chalk.bold(error.message));
    console.error(chalk.dim(`Code: ${error.code}`));

    if (error.context?.suggestions && error.context.suggestions.length > 0) {
      console.error(chalk.cyan('\nSuggestions:'));
      for (const suggestion of error.context.suggestions) {
        console.error(chalk.dim(`  → ${suggestion}`));
      }
    }
  } else if (error instanceof Error) {
    console.error(chalk.bold(error.message));

    // Provide contextual suggestions
    const suggestions = getSuggestionsForError(error.message, context);
    if (suggestions.length > 0) {
      console.error(chalk.cyan('\nSuggestions:'));
      for (const suggestion of suggestions) {
        console.error(chalk.dim(`  → ${suggestion}`));
      }
    }
  } else {
    console.error(chalk.bold(String(error)));
  }

  // Show help command if context available
  if (context?.command) {
    console.error(chalk.dim(`\nRun: one4all ${context.command} --help`));
  }

  process.exit(1);
}

/**
 * Get actionable suggestions for common errors
 */
function getSuggestionsForError(message: string, context?: ErrorContext): string[] {
  const suggestions: string[] = [];
  const lowerMessage = message.toLowerCase();

  // File not found errors
  if (lowerMessage.includes('not found') || lowerMessage.includes('enoent')) {
    if (lowerMessage.includes('agent')) {
      suggestions.push('Import agents from source: one4all agents import --all');
      suggestions.push('List available agents: one4all agents list');
    } else if (lowerMessage.includes('domain')) {
      suggestions.push('Create a new domain: one4all domains create --help');
      suggestions.push('List available domains: one4all domains list');
    } else if (lowerMessage.includes('mission')) {
      suggestions.push('Create a mission: one4all mission create --help');
      suggestions.push('List missions: one4all mission list');
    } else {
      suggestions.push('Check the file path and try again');
    }
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
    suggestions.push('Increase timeout in agent configuration');
    suggestions.push('Check your network connection');
    suggestions.push('Try using a different CLI provider');
  }

  // Authentication errors
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
    suggestions.push('Check CLI authentication: gemini auth login or claude auth login');
    suggestions.push('Verify API keys in .env file');
  }

  // Validation errors
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    suggestions.push('Run validation: one4all validate all');
    suggestions.push('Check configuration format');
  }

  // Permission errors
  if (lowerMessage.includes('permission') || lowerMessage.includes('eacces')) {
    suggestions.push('Check file permissions');
    suggestions.push('Try running with appropriate permissions');
  }

  // Command not found
  if (lowerMessage.includes('command not found') || lowerMessage.includes('is not recognized')) {
    const match = lowerMessage.match(/command not found:?\s+(\S+)/);
    if (match) {
      const cmd = match[1];
      if (cmd === 'gemini') {
        suggestions.push('Install Gemini CLI: npm install -g @google/gemini-cli');
      } else if (cmd === 'claude') {
        suggestions.push('Install Claude CLI: npm install -g @anthropic-ai/claude-code');
      }
    }
  }

  return suggestions;
}

// === CONTEXTUAL HELP ===

/**
 * Show contextual help for commands
 */
export function showCommandHelp(command: string): void {
  const helpText: Record<string, string> = {
    'agents create': `
${chalk.bold('Create a new Agent')}

${chalk.yellow('Examples:')}
  # Create with flags
  one4all agents create \\
    --id "tech-analyst" \\
    --name "Technology Analyst" \\
    --domain "investment-war-room" \\
    --provider "gemini-cli"

  # Create from template
  one4all agents create --clone "damodaran-valuation" --id "growth-analyst"

  # Interactive mode
  one4all agents create --interactive
`,
    'domains create': `
${chalk.bold('Create a new Domain')}

${chalk.yellow('Available Templates:')}
  - investment-war-room: Investment analysis
  - content-creator: Content creation
  - research-studio: Academic research
  - crypto-analysis: Cryptocurrency analysis

${chalk.yellow('Examples:')}
  # Create from template
  one4all domains create \\
    --id "my-domain" \\
    --template "content-creator"

  # Create from scratch
  one4all domains create \\
    --id "custom-domain" \\
    --name "My Custom Domain" \\
    --description "Description here"
`,
    'mission create': `
${chalk.bold('Create a new Mission')}

${chalk.yellow('Required Options:')}
  --domain <domain>       Domain to use
  --type <type>           Mission type
  --ticker <symbol>       Stock ticker (for stock analysis)

${chalk.yellow('Examples:')}
  one4all mission create \\
    --domain "investment-war-room" \\
    --type "stock_analysis" \\
    --ticker "NVDA" \\
    --description "Valuation analysis"
`,
  };

  if (helpText[command]) {
    console.log(helpText[command]);
  } else {
    console.log(chalk.dim(`Run: one4all ${command.split(' ')[0]} --help`));
  }
}

// === PROGRESS INDICATORS ===

/**
 * Progress spinner for long operations
 */
export class ProgressIndicator {
  private spinners: Map<string, Ora> = new Map();

  /**
   * Start a new spinner
   */
  start(id: string, text: string): Ora {
    const spinner = ora({
      text,
      color: 'cyan',
    }).start();

    this.spinners.set(id, spinner);
    return spinner;
  }

  /**
   * Update spinner text
   */
  update(id: string, text: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.text = text;
    }
  }

  /**
   * Succeed a spinner
   */
  succeed(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.succeed(text);
      this.spinners.delete(id);
    }
  }

  /**
   * Fail a spinner
   */
  fail(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.fail(text);
      this.spinners.delete(id);
    }
  }

  /**
   * Stop all spinners
   */
  stopAll(): void {
    for (const [id, spinner] of this.spinners) {
      spinner.stop();
    }
    this.spinners.clear();
  }
}

/**
 * Format a progress bar
 */
export function formatProgressBar(current: number, total: number, width = 30): string {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((width * percentage) / 100);
  const empty = width - filled;

  const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const pct = chalk.bold(`${Math.round(percentage)}%`);

  return `${bar} ${pct} ${chalk.dim(`(${current}/${total})`)}`;
}

/**
 * Format a duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// === SUCCESS/WARNING/INFO MESSAGES ===

/**
 * Show a success message
 */
export function success(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Show a warning message
 */
export function warning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Show an info message
 */
export function info(message: string): void {
  console.log(chalk.dim(`ℹ ${message}`));
}

/**
 * Show a header
 */
export function header(text: string): void {
  console.log(chalk.cyan.bold(`\n${'═'.repeat(50)}`));
  console.log(chalk.cyan.bold(`  ${text}`));
  console.log(chalk.cyan.bold(`${'═'.repeat(50)}\n`));
}

/**
 * Show a section header
 */
export function section(text: string): void {
  console.log(chalk.bold(`\n${text}`));
  console.log(chalk.dim('─'.repeat(text.length)));
}
