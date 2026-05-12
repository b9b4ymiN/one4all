/**
 * Context Manager Types
 */

import type { AdapterType } from '@one4all/adapters';

/**
 * Context budget for a specific model
 */
export interface ContextBudget {
  model: string;
  adapterType: AdapterType;
  maxTokens: number; // Maximum context window
  reservedTokens: number; // Reserved for system prompt
  availableTokens: number; // maxTokens - reservedTokens
  costPerMillionTokens: {
    input: number;
    output: number;
  };
}

/**
 * Context allocation for a specific agent
 */
export interface AgentContextAllocation {
  agentName: string;
  agentType: 'researcher' | 'analyst' | 'synthesizer' | 'validator';
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  currentUsage: {
    input: number;
    output: number;
  };
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  budgets: ContextBudget[];
  defaultBudget: ContextBudget;
  compressionThreshold: number; // 0.0-1.0, when to trigger compression
  prioritizeRecent: boolean; // Whether to prioritize recent content
  reserveSystemTokens: number; // Tokens to reserve for system messages
}

/**
 * Result of a compression operation
 */
export interface CompressionResult {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number; // compressed / original
  strategy: string;
  content: string;
  metadata?: {
    removedSections?: string[];
    summaries?: string[];
    preservedElements?: string[];
  };
}

/**
 * Content item for context management
 */
export interface ContextItem {
  id: string;
  content: string;
  tokens: number;
  priority: number; // 1-10, higher = more important
  timestamp: number;
  type: 'evidence' | 'analysis' | 'debate' | 'system' | 'user_input';
  metadata?: Record<string, unknown>;
}
