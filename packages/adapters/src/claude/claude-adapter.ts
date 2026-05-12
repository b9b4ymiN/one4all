/**
 * Claude Adapter - Real Anthropic API integration
 *
 * Features:
 * - Streaming support
 * - Retry logic with exponential backoff
 * - Proper error handling
 * - Token counting and cost estimation
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Adapter,
  AdapterConfig,
  AgentResult,
  HealthStatus,
} from '../types/adapter.types';

export interface ClaudeAdapterConfig extends AdapterConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  retryDelay?: number; // ms
  timeout?: number; // ms
  stream?: boolean;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  stream?: boolean;
}

// Claude model pricing (per million tokens)
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 1, output: 5 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'claude-3-sonnet-20240229': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const DEFAULT_TIMEOUT = 60000; // 60 seconds

export class ClaudeAdapter implements Adapter {
  private client: Anthropic;
  private config: {
    apiKey: string;
    model: string;
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    temperature: number;
    maxTokens: number;
    stream: boolean;
  };

  constructor(config: ClaudeAdapterConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
      model: config.model ?? DEFAULT_MODEL,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: config.stream ?? false,
    };

    if (!this.config.apiKey) {
      throw new Error('Claude API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config.');
    }

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });
  }

  /**
   * Run the Claude adapter with the given prompt
   */
  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const startTime = Date.now();
    const messages: ClaudeMessage[] = [
      { role: 'user', content: prompt },
    ];

    const options: ClaudeOptions = {
      model: config.model ?? this.config.model,
      maxTokens: config.maxTokens ?? this.config.maxTokens,
      temperature: config.temperature ?? this.config.temperature,
      stream: (config.stream as boolean | undefined) ?? this.config.stream,
    };

    try {
      let content: string;
      let inputTokens = 0;
      let outputTokens = 0;

      if (options.stream) {
        const streamResult = await this.streamRun(messages, options);
        content = streamResult.content;
        inputTokens = streamResult.inputTokens;
        outputTokens = streamResult.outputTokens;
      } else {
        const result = await this.runWithRetry(messages, options);
        content = result.content;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
      }

      const completedAt = Date.now();
      const cost = this.estimateCost(inputTokens, outputTokens);

      return {
        success: true,
        content,
        model: options.model ?? DEFAULT_MODEL,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        cost,
        timing: {
          startedAt: startTime,
          completedAt,
          durationMs: completedAt - startTime,
        },
        metadata: {
          streamed: options.stream,
          retries: 0,
        },
      };
    } catch (error) {
      const completedAt = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        content: '',
        model: options.model ?? DEFAULT_MODEL,
        error: errorMessage,
        timing: {
          startedAt: startTime,
          completedAt,
          durationMs: completedAt - startTime,
        },
      };
    }
  }

  /**
   * Run with retry logic
   */
  private async runWithRetry(
    messages: ClaudeMessage[],
    options: ClaudeOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        const response = await this.client.messages.create({
          model: options.model ?? DEFAULT_MODEL,
          max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: options.temperature,
          messages: messages as { role: 'user' | 'assistant'; content: string }[],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from Claude API');
        }

        return {
          content: content.text,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt <= this.config.maxRetries && this.isRetryableError(lastError)) {
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        } else {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error('Unknown error in runWithRetry');
  }

  /**
   * Run with streaming
   */
  private async streamRun(
    messages: ClaudeMessage[],
    options: ClaudeOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    try {
      const stream = await this.client.messages.create({
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options.temperature,
        stream: true,
        messages: messages as { role: 'user' | 'assistant'; content: string }[],
      });

      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            inputTokens = event.message.usage.input_tokens;
            break;
          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              content += event.delta.text;
            }
            break;
          case 'message_delta':
            outputTokens = event.usage.output_tokens;
            break;
        }
      }

      return { content, inputTokens, outputTokens };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Retry on rate limits, timeouts, and server errors
    return (
      message.includes('rate_limit') ||
      message.includes('timeout') ||
      message.includes('temporary') ||
      message.includes('unavailable') ||
      message.includes('520') ||
      message.includes('527') ||
      message.includes('503')
    );
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for the adapter
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Make a minimal API call to check health
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs: latency,
        metadata: {
          model: this.config.model,
          version: response.model,
          id: response.id,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          model: this.config.model,
        },
      };
    }
  }

  /**
   * Estimate token count for a prompt
   */
  estimateTokens(prompt: string): number {
    // Claude uses a different tokenizer, but we'll use a rough estimate
    // Approximate: 1 token ≈ 3.5 characters for Claude
    return Math.ceil(prompt.length / 3.5);
  }

  /**
   * Estimate cost in USD for given token usage
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    const pricing = CLAUDE_PRICING[this.config.model] ?? CLAUDE_PRICING[DEFAULT_MODEL];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get adapter name
   */
  getName(): string {
    return `ClaudeAdapter(${this.config.model})`;
  }

  /**
   * Get the current model
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Set a new model
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * Get the Anthropic client (for advanced usage)
   */
  getClient(): Anthropic {
    return this.client;
  }
}
