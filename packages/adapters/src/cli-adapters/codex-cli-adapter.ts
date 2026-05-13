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
      // Use --json for structured output and --ephemeral for non-persistent session
      // Use --dangerously-bypass-approvals-and-sandbox for non-interactive execution
      const args = [
        'exec',
        prompt,
        '--skip-git-repo-check',
        '--json',
        '--ephemeral',
        '--dangerously-bypass-approvals-and-sandbox'
      ];
      // Close stdin to prevent process from waiting for input
      const process = spawn(this.config.codexPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      const jsonlLines: string[] = [];
      let stderr = '';

      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        // Collect all JSONL lines
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            jsonlLines.push(line.trim());
          }
        }
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

        if (code !== 0 && code !== 130) {  // 130 is Ctrl+C, which we might use
          reject(new Error(`Codex CLI exited with code ${code}: ${stderr}`));
          return;
        }

        // Parse JSONL output to find the final response
        // Codex JSONL format: {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
        for (const line of jsonlLines) {
          try {
            const event = JSON.parse(line);
            // Look for item.completed with agent_message containing text
            if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item?.text) {
              resolve(event.item.text);
              return;
            }
            // Also check for other content formats
            if (event.item?.text) {
              resolve(event.item.text);
              return;
            }
            if (event.content) {
              resolve(event.content);
              return;
            }
          } catch {
            // Not a JSON line, skip
          }
        }

        // Fallback: extract all text content from JSONL events
        const contents: string[] = [];
        for (const line of jsonlLines) {
          try {
            const event = JSON.parse(line);
            if (event.item?.text && typeof event.item.text === 'string') {
              contents.push(event.item.text);
            } else if (event.content && typeof event.content === 'string') {
              contents.push(event.content);
            }
          } catch {}
        }

        if (contents.length > 0) {
          resolve(contents.join('\n').trim());
        } else {
          // Last resort: return all non-JSON lines
          const textLines = jsonlLines.filter(l => !l.startsWith('{')).join('\n').trim();
          resolve(textLines || jsonlLines.join('\n') || 'No response from Codex CLI');
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
