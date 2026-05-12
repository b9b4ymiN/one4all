/**
 * Gemini CLI Adapter
 *
 * Wraps the Gemini CLI tool to use it as an LLM backend.
 * Requires: gemini CLI to be installed and authenticated
 */

import { spawn } from 'child_process';
import type {
  AdapterConfig,
  AgentResult,
  HealthStatus,
} from '../types/adapter.types';

export interface GeminiCLIAdapterConfig extends AdapterConfig {
  geminiPath?: string;
  timeout?: number;
  maxRetries?: number;
}

export class GeminiCLIAdapter {
  private config: {
    geminiPath: string;
    timeout: number;
    maxRetries: number;
    model: string;
  };

  constructor(config: GeminiCLIAdapterConfig = {}) {
    this.config = {
      geminiPath: config.geminiPath || 'gemini',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 0,
      model: config.model || 'gemini-cli',
    };
  }

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const response = await this.executeGeminiCLI(prompt);

      return {
        success: true,
        content: response,
        model: this.config.model,
        timing: {
          startedAt: startTime,
          completedAt: Date.now(),
          durationMs: Date.now() - startTime,
        },
        // CLI adapters don't provide token counts
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

  private async executeGeminiCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-p', prompt, '--output-format', 'json'];
      const process = spawn(this.config.geminiPath, args);

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
        reject(new Error(`Gemini CLI timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      process.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Gemini CLI may output warnings before JSON
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            reject(new Error('No JSON found in Gemini CLI output'));
            return;
          }

          const result = JSON.parse(jsonMatch[0]);

          // Gemini CLI JSON format: { "response": "..." }
          if (result.response) {
            resolve(result.response);
          } else {
            reject(new Error('Unexpected Gemini CLI JSON format'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Gemini CLI JSON: ${error}`));
        }
      });
    });
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Simple health check - run a minimal prompt
      const result = await this.executeGeminiCLI('ping');
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs,
        metadata: {
          model: this.config.model,
          adapter: 'GeminiCLIAdapter',
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
    // Rough approximation: ~4 chars per token
    return Math.ceil(prompt.length / 4);
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini CLI doesn't report costs, return 0
    return 0;
  }

  getName(): string {
    return `GeminiCLIAdapter(${this.config.model})`;
  }

  getModel(): string {
    return this.config.model;
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  getClient(): unknown {
    return null; // CLI adapters don't have a client
  }
}
