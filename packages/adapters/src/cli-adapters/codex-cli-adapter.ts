/**
 * Codex CLI Adapter
 *
 * Wraps the Codex CLI tool to use it as an LLM backend.
 * Requires: codex CLI to be installed and authenticated
 */

import { spawn } from 'child_process';
import type {
  AdapterConfig,
  AgentResult,
  HealthStatus,
} from '../types/adapter.types';

export interface CodexCLIAdapterConfig extends AdapterConfig {
  codexPath?: string;
  timeout?: number;
  maxRetries?: number;
}

export class CodexCLIAdapter {
  private config: {
    codexPath: string;
    timeout: number;
    maxRetries: number;
    model: string;
  };

  constructor(config: CodexCLIAdapterConfig = {}) {
    this.config = {
      codexPath: config.codexPath || 'codex',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 0,
      model: config.model || 'codex-cli',
    };
  }

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const response = await this.executeCodexCLI(prompt);

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

  private async executeCodexCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Codex CLI requires --skip-git-repo-check when not in a git directory
      const args = ['exec', prompt, '--output-format', 'json', '--skip-git-repo-check'];
      const process = spawn(this.config.codexPath, args);

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
        reject(new Error(`Codex CLI timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      process.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`Codex CLI exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            // Codex might return text output without JSON
            resolve(stdout.trim());
            return;
          }

          const result = JSON.parse(jsonMatch[0]);

          // Codex CLI JSON format - need to verify actual structure
          // Assuming similar format to other CLIs
          if (result.response || result.result || result.content || result.message) {
            resolve(result.response || result.result || result.content || result.message);
          } else if (typeof result === 'string') {
            resolve(result);
          } else {
            // Fallback to raw output if structure is unknown
            resolve(stdout.trim());
          }
        } catch (error) {
          // If JSON parsing fails, return raw output
          resolve(stdout.trim());
        }
      });
    });
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const result = await this.executeCodexCLI('ping');
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs,
        metadata: {
          model: this.config.model,
          adapter: 'CodexCLIAdapter',
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
    return `CodexCLIAdapter(${this.config.model})`;
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
