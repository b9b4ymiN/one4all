/**
 * ZAI Adapter - OpenAI-compatible API integration
 *
 * Features:
 * - OpenAI SDK integration for OpenAI-compatible endpoints
 * - Streaming support
 * - Retry logic with exponential backoff
 * - Proper error handling
 * - Token counting and cost estimation
 * - Configurable baseURL for different providers
 */

import OpenAI from 'openai';
import type {
  Adapter,
  AdapterConfig,
  AgentResult,
  HealthStatus,
} from '../types/adapter.types';

export interface ZAIAdapterConfig extends AdapterConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxRetries?: number;
  retryDelay?: number; // ms
  timeout?: number; // ms
  stream?: boolean;
}

export interface ZAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ZAIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
}

// OpenAI model pricing (per million tokens)
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 30, output: 60 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4-turbo-preview': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-16k': { input: 0.5, output: 1.5 },
};

const DEFAULT_MODEL = 'gpt-4-turbo';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const DEFAULT_TIMEOUT = 60000; // 60 seconds

export class ZAIAdapter implements Adapter {
  private client: OpenAI;
  private config: {
    apiKey: string;
    baseURL: string;
    model: string;
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    temperature: number;
    maxTokens: number;
    stream: boolean;
  };

  constructor(config: ZAIAdapterConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      baseURL: config.baseURL ?? 'https://api.openai.com/v1',
      model: config.model ?? DEFAULT_MODEL,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: config.stream ?? false,
    };

    if (!this.config.apiKey) {
      throw new Error('ZAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.');
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      maxRetries: 0, // We handle retries ourselves
      timeout: this.config.timeout,
    });
  }

  /**
   * Run the ZAI adapter with the given prompt
   */
  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const startTime = Date.now();
    const messages: ZAIMessage[] = [
      { role: 'user', content: prompt },
    ];

    const options: ZAIOptions = {
      model: (config.model as string | undefined) ?? this.config.model,
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
          baseURL: this.config.baseURL,
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
        metadata: {
          baseURL: this.config.baseURL,
        },
      };
    }
  }

  /**
   * Run with retry logic
   */
  private async runWithRetry(
    messages: ZAIMessage[],
    options: ZAIOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        const response = await this.client.chat.completions.create({
          model: options.model ?? DEFAULT_MODEL,
          messages: messages as { role: 'system' | 'user' | 'assistant'; content: string }[],
          max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: options.temperature,
        });

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No choices returned from ZAI API');
        }

        return {
          content: choice.message.content ?? '',
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
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
    messages: ZAIMessage[],
    options: ZAIOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model ?? DEFAULT_MODEL,
        messages: messages as { role: 'system' | 'user' | 'assistant'; content: string }[],
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options.temperature,
        stream: true,
      });

      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          content += delta.content;
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      // If usage wasn't provided in stream, estimate it
      if (inputTokens === 0 && outputTokens === 0) {
        inputTokens = this.estimateTokens(messages.map(m => m.content).join('\n'));
        outputTokens = this.estimateTokens(content);
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
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('temporary') ||
      message.includes('unavailable') ||
      message.includes('520') ||
      message.includes('527') ||
      message.includes('503') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502')
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
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      });

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs: latency,
        metadata: {
          model: this.config.model,
          id: response.id,
          baseURL: this.config.baseURL,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          model: this.config.model,
          baseURL: this.config.baseURL,
        },
      };
    }
  }

  /**
   * Estimate token count for a prompt
   */
  estimateTokens(prompt: string): number {
    // OpenAI uses a different tokenizer, but we'll use a rough estimate
    // Approximate: 1 token ≈ 4 characters for OpenAI
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Estimate cost in USD for given token usage
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    const pricing = OPENAI_PRICING[this.config.model] ?? OPENAI_PRICING[DEFAULT_MODEL];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get adapter name
   */
  getName(): string {
    const provider = this.getProviderName();
    return `ZAIAdapter(${this.config.model}, ${provider})`;
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
   * Get the base URL
   */
  getBaseURL(): string {
    return this.config.baseURL;
  }

  /**
   * Set a new base URL
   */
  setBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: baseURL,
      maxRetries: 0,
      timeout: this.config.timeout,
    });
  }

  /**
   * Get the OpenAI client (for advanced usage)
   */
  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Get provider name from baseURL
   */
  private getProviderName(): string {
    const url = this.config.baseURL;
    if (url.includes('api.openai.com')) return 'OpenAI';
    if (url.includes('anthropic')) return 'Anthropic';
    if (url.includes('groq')) return 'Groq';
    if (url.includes('together')) return 'Together';
    if (url.includes('deepinfra')) return 'DeepInfra';
    return 'Custom';
  }
}
