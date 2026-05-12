/**
 * Compression Strategy - Smart context compression for large contexts
 */

import type { ContextItem, CompressionResult } from './types';

export class CompressionStrategy {
  private readonly tokenRatio = 4; // Approximate chars per token

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.tokenRatio);
  }

  /**
   * Compress context items to fit within token limit
   */
  compress(items: ContextItem[], maxTokens: number, options?: {
    prioritizeRecent?: boolean;
    preservePriorityThreshold?: number; // 1-10, preserve items at or above this priority
  }): CompressionResult {
    const originalTokens = items.reduce((sum, item) => sum + item.tokens, 0);

    // If already under limit, no compression needed
    if (originalTokens <= maxTokens) {
      return {
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 1,
        strategy: 'none',
        content: this.formatItems(items),
      };
    }

    const prioritizeRecent = options?.prioritizeRecent ?? true;
    const priorityThreshold = options?.preservePriorityThreshold ?? 7;

    // Sort by priority and timestamp
    const sorted = [...items].sort((a, b) => {
      // First by priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by timestamp (recent first if prioritizing recent)
      return prioritizeRecent
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp;
    });

    // Keep high-priority items, compress lower priority
    const highPriority: ContextItem[] = [];
    const toCompress: ContextItem[] = [];

    for (const item of sorted) {
      if (item.priority >= priorityThreshold) {
        highPriority.push(item);
      } else {
        toCompress.push(item);
      }
    }

    // Calculate remaining budget
    const highPriorityTokens = highPriority.reduce((sum, item) => sum + item.tokens, 0);
    let remainingBudget = maxTokens - highPriorityTokens;

    // Add items from toCompress until budget exhausted
    const compressed: ContextItem[] = [];
    const removedIds: string[] = [];

    for (const item of toCompress) {
      if (item.tokens <= remainingBudget) {
        compressed.push(item);
        remainingBudget -= item.tokens;
      } else {
        removedIds.push(item.id);
      }
    }

    // Summarize removed items if there's budget
    const summaries: string[] = [];
    if (removedIds.length > 0 && remainingBudget > 100) {
      const summary = this.summarizeRemoved(items.filter(i => removedIds.includes(i.id)));
      if (summary) {
        summaries.push(summary);
        remainingBudget -= this.estimateTokens(summary);
      }
    }

    const finalItems = [...highPriority, ...compressed];
    const compressedTokens = finalItems.reduce((sum, item) => sum + item.tokens, 0);

    return {
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
      strategy: prioritizeRecent ? 'priority-then-recent' : 'priority-only',
      content: this.formatItems(finalItems, summaries),
      metadata: {
        removedSections: removedIds,
        summaries,
        preservedElements: finalItems.map(i => i.id),
      },
    };
  }

  /**
   * Smart summarization of removed context items
   */
  summarizeRemoved(items: ContextItem[]): string {
    if (items.length === 0) {
      return '';
    }

    const byType = new Map<string, ContextItem[]>();
    for (const item of items) {
      const existing = byType.get(item.type) ?? [];
      existing.push(item);
      byType.set(item.type, existing);
    }

    const parts: string[] = [];
    for (const [type, typeItems] of byType) {
      const count = typeItems.length;
      const tokens = typeItems.reduce((sum, i) => sum + i.tokens, 0);
      parts.push(`${count} ${type} items (${tokens} tokens)`);
    }

    return `[Compressed: ${parts.join(', ')}]`;
  }

  /**
   * Truncate text to fit within token limit
   */
  truncate(text: string, maxTokens: number, fromEnd = true): string {
    const estimatedTokens = this.estimateTokens(text);

    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const maxChars = maxTokens * this.tokenRatio;
    const ellipsis = '...';

    if (text.length <= maxChars + ellipsis.length) {
      return text;
    }

    if (fromEnd) {
      return text.slice(0, maxChars) + ellipsis;
    } else {
      return ellipsis + text.slice(-maxChars);
    }
  }

  /**
   * Deduplicate context items based on content similarity
   */
  deduplicate(items: ContextItem[], similarityThreshold = 0.9): ContextItem[] {
    const seen = new Set<string>();
    const unique: ContextItem[] = [];

    for (const item of items) {
      const hash = this.simpleHash(item.content);
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(item);
      }
    }

    return unique;
  }

  /**
   * Simple hash for content deduplication
   */
  private simpleHash(content: string): string {
    // Normalize: lowercase, remove extra whitespace
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    // Use first 100 chars as a simple hash
    return normalized.slice(0, 100);
  }

  /**
   * Format context items into a single string
   */
  private formatItems(items: ContextItem[], summaries?: string[]): string {
    const parts: string[] = [];

    // Add summaries first if present
    if (summaries && summaries.length > 0) {
      parts.push(...summaries);
    }

    // Add items in timestamp order
    const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
    for (const item of sorted) {
      parts.push(`[${item.type}] ${item.content}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Merge context items intelligently
   */
  merge(items: ContextItem[]): ContextItem[] {
    const grouped = new Map<string, ContextItem[]>();

    // Group by type
    for (const item of items) {
      const existing = grouped.get(item.type) ?? [];
      existing.push(item);
      grouped.set(item.type, existing);
    }

    const merged: ContextItem[] = [];

    // Merge each group
    for (const [type, typeItems] of grouped) {
      if (typeItems.length === 1) {
        merged.push(typeItems[0]);
      } else {
        // Merge multiple items of same type
        const combined = typeItems.map(i => i.content).join('\n');
        merged.push({
          id: `merged-${type}-${Date.now()}`,
          content: combined,
          tokens: this.estimateTokens(combined),
          priority: Math.max(...typeItems.map(i => i.priority)),
          timestamp: Math.max(...typeItems.map(i => i.timestamp)),
          type: type as ContextItem['type'],
          metadata: { mergedFrom: typeItems.map(i => i.id) },
        });
      }
    }

    return merged;
  }

  /**
   * Compress by removing redundancy within items
   */
  removeRedundancy(items: ContextItem[]): ContextItem[] {
    const seenContent = new Set<string>();
    const filtered: ContextItem[] = [];

    for (const item of items) {
      const signature = this.getContentSignature(item.content);
      if (!seenContent.has(signature)) {
        seenContent.add(signature);
        filtered.push(item);
      }
    }

    return filtered;
  }

  /**
   * Get a signature of content for redundancy detection
   */
  private getContentSignature(content: string): string {
    // Remove common words, normalize
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3); // Skip short words

    // Create a sorted set of unique significant words
    const unique = [...new Set(words)].sort();
    return unique.slice(0, 20).join(' '); // First 20 significant words
  }
}
