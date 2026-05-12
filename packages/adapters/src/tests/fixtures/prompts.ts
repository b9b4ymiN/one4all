/**
 * Standardized test prompts for adapter testing
 */

export interface TestPrompt {
  id: string;
  text: string;
  category: 'simple' | 'medium' | 'complex';
}

/**
 * Canonical test prompts for adapter validation
 */
export const CANONICAL_PROMPTS: TestPrompt[] = [
  {
    id: 'simple-greeting',
    text: 'Hello! Can you help me today?',
    category: 'simple',
  },
  {
    id: 'simple-question',
    text: 'What is the capital of France?',
    category: 'simple',
  },
  {
    id: 'medium-reasoning',
    text: 'If I have 5 apples and eat 2, then buy 3 more, how many do I have? Explain your reasoning.',
    category: 'medium',
  },
  {
    id: 'medium-code',
    text: 'Write a JavaScript function that calculates the factorial of a number.',
    category: 'medium',
  },
  {
    id: 'complex-multi-step',
    text: `You are given a list of tasks with priorities. Implement a task scheduler that:
1. Prioritizes high-priority tasks first
2. Handles task dependencies
3. Provides estimated completion time

Explain your approach and provide pseudocode.`,
    category: 'complex',
  },
  {
    id: 'complex-refactoring',
    text: `Review this code and suggest improvements for better maintainability:
function processData(a, b, c) {
  var x = a + b;
  var y = x * c;
  if (y > 100) return y;
  else return x;
}

Provide refactored code with explanations.`,
    category: 'complex',
  },
];

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: TestPrompt['category']): TestPrompt[] {
  return CANONICAL_PROMPTS.filter((p) => p.category === category);
}

/**
 * Get a specific prompt by ID
 */
export function getPromptById(id: string): TestPrompt | undefined {
  return CANONICAL_PROMPTS.find((p) => p.id === id);
}
