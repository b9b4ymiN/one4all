/**
 * Claude Code CLI Adapter
 *
 * Wraps the Claude Code CLI tool to use it as an LLM backend.
 * Requires: claude CLI to be installed and authenticated
 */

import { spawn } from 'child_process';
import type {
  AdapterConfig,
  AgentResult,
  HealthStatus,
} from '../types/adapter.types';

export interface ClaudeCLIAdapterConfig extends AdapterConfig {
  claudePath?: string;
  timeout?: number;
  maxRetries?: number;
}

export class ClaudeCLIAdapter {
  private config: {
    claudePath: string;
    timeout: number;
    maxRetries: number;
    model: string;
  };

  constructor(config: ClaudeCLIAdapterConfig = {}) {
    this.config = {
      claudePath: config.claudePath || 'claude',
      timeout: config.timeout || 120000, // Claude may take longer
      maxRetries: config.maxRetries || 0,
      model: config.model || 'claude-cli',
    };
  }

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const response = await this.executeClaudeCLI(prompt);

      return {
        success: true,
        content: response,
        model: this.config.model,
        timing: {
          startedAt: startTime,
          completedAt: Date.now(),
          durationMs: Date.now() - startTime,
        },
        tokensUsed: undefined,
        cost: undefined,
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        model: this.config.model,
        error: error instanceof Error ? error.message : String(error),
        timing: {
          startedAt: startTime,
          completedAt: Date.now(),
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  private async executeClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Claude CLI uses --output-format json
      const args = ['-p', prompt, '--output-format', 'json'];
      const process = spawn(this.config.claudePath, args);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill();
        reject(new Error(`Claude CLI timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      process.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Claude CLI returns JSON directly
          const result = JSON.parse(stdout.trim());

          // Claude CLI JSON format: { "type": "result", "result": "..." }
          if (result.type === 'result' && result.result) {
            resolve(result.result);
          } else if (result.error) {
            reject(new Error(`Claude CLI error: ${result.error}`));
          } else if (typeof result === 'string') {
            resolve(result);
          } else {
            reject(new Error('Unexpected Claude CLI JSON format'));
          }
        } catch (error) {
          // If JSON parsing fails, try to extract the result field
          const resultMatch = stdout.match(/"result"\s*:\s*"([^"]+)"/);
          if (resultMatch) {
            // Remove escaped quotes
            resolve(resultMatch[1].replace(/\\"/g, '"'));
          } else {
            reject(new Error(`Failed to parse Claude CLI JSON: ${error}`));
          }
        }
      });
    });
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const result = await this.executeClaudeCLI('ping');
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs,
        metadata: {
          model: this.config.model,
          adapter: 'ClaudeCLIAdapter',
        },
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  estimateTokens(prompt: string): number {
    return Math.ceil(prompt.length / 4);
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return 0;
  }

  getName(): string {
    return `ClaudeCLIAdapter(${this.config.model})`;
  }

  getModel(): string {
    return this.config.model;
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  getClient(): unknown {
    return null;
  }
}
