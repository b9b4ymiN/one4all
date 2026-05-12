/**
 * Gemini Adapter - Real Google API integration
 *
 * Features:
 * - Google Generative AI SDK integration
 * - Streaming support
 * - Retry logic with exponential backoff
 * - Proper error handling
 * - Token counting and cost estimation
 * - Configurable model selection
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  Adapter,
  AdapterConfig,
  AgentResult,
  HealthStatus,
} from '../types/adapter.types';

export interface GeminiAdapterConfig extends AdapterConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  retryDelay?: number; // ms
  timeout?: number; // ms
  stream?: boolean;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stream?: boolean;
}

// Gemini model pricing (per million tokens)
// Source: https://ai.google.dev/pricing
const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-1.5-pro': { input: 3.50, output: 10.50 },
  'gemini-1.5-pro-001': { input: 3.50, output: 10.50 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash-001': { input: 0.075, output: 0.30 },
  'gemini-1.0-pro': { input: 0.50, output: 1.50 },
  'gemini-pro': { input: 0.50, output: 1.50 },
};

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const DEFAULT_TIMEOUT = 60000; // 60 seconds

export class GeminiAdapter implements Adapter {
  private client: GoogleGenerativeAI;
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

  constructor(config: GeminiAdapterConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.GOOGLE_API_KEY ?? '',
      model: config.model ?? DEFAULT_MODEL,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: config.stream ?? false,
    };

    if (!this.config.apiKey) {
      throw new Error('Gemini API key is required. Set GOOGLE_API_KEY environment variable or pass apiKey in config.');
    }

    this.client = new GoogleGenerativeAI(this.config.apiKey);
  }

  /**
   * Run the Gemini adapter with the given prompt
   */
  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const startTime = Date.now();

    const options: GeminiOptions = {
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
        const streamResult = await this.streamRun(prompt, options);
        content = streamResult.content;
        inputTokens = streamResult.inputTokens;
        outputTokens = streamResult.outputTokens;
      } else {
        const result = await this.runWithRetry(prompt, options);
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
    prompt: string,
    options: GeminiOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        const model = this.client.getGenerativeModel({
          model: options.model ?? DEFAULT_MODEL,
        });

        const result = await Promise.race([
          model.generateContent(prompt),
          this.createTimeout(this.config.timeout),
        ]);

        const response = result.response;
        const text = response.text();

        // Estimate tokens if usage metadata is not available
        const inputTokens = this.estimateTokens(prompt);
        const outputTokens = this.estimateTokens(text);

        return {
          content: text,
          inputTokens,
          outputTokens,
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
    prompt: string,
    options: GeminiOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    try {
      const model = this.client.getGenerativeModel({
        model: options.model ?? DEFAULT_MODEL,
      });

      const result = await Promise.race([
        model.generateContentStream(prompt),
        this.createTimeout(this.config.timeout),
      ]);

      let content = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          content += chunkText;
        }
      }

      // Estimate tokens
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(content);

      return { content, inputTokens, outputTokens };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
    });
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
      message.includes('quota') ||
      message.includes('timeout') ||
      message.includes('temporary') ||
      message.includes('unavailable') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('500') ||
      message.includes('429')
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
      const model = this.client.getGenerativeModel({
        model: this.config.model,
      });

      await Promise.race([
        model.generateContent('Hi'),
        this.createTimeout(Math.min(this.config.timeout, 10000)),
      ]);

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs: latency,
        metadata: {
          model: this.config.model,
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
   * Gemini uses approximately 4 characters per token
   */
  estimateTokens(prompt: string): number {
    if (!prompt) return 0;
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Estimate cost in USD for given token usage
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    // Find matching pricing - use prefix matching for model versions
    let pricing = GEMINI_PRICING[DEFAULT_MODEL];

    const modelKey = Object.keys(GEMINI_PRICING).find(key =>
      this.config.model.startsWith(key) || key.startsWith(this.config.model)
    );

    if (modelKey) {
      pricing = GEMINI_PRICING[modelKey];
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get adapter name
   */
  getName(): string {
    return `GeminiAdapter(${this.config.model})`;
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
   * Get the Google Generative AI client (for advanced usage)
   */
  getClient(): GoogleGenerativeAI {
    return this.client;
  }
}
