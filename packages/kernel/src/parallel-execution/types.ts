/**
 * Parallel Execution Types
 *
 * Types for running multiple agents concurrently with proper coordination
 */

/**
 * Individual agent task to execute
 */
export interface AgentTask<T = unknown> {
  /** Unique task identifier */
  id: string;
  /** Agent ID to execute */
  agentId: string;
  /** Task name/description */
  name: string;
  /** Prompt/input for the agent */
  input: string;
  /** Additional context for the agent */
  context?: Record<string, unknown>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Dependencies - tasks that must complete before this one starts */
  dependsOn?: string[];
  /** Priority for execution scheduling */
  priority?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * Result from a single agent execution
 */
export interface AgentTaskResult<T = unknown> {
  /** Task ID */
  taskId: string;
  /** Agent ID */
  agentId: string;
  /** Whether the task completed successfully */
  success: boolean;
  /** Output data if successful */
  output?: T;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Timestamp when task completed */
  completedAt: Date;
  /** Number of retries attempted */
  retries: number;
}

/**
 * Progress update for a running task
 */
export interface TaskProgress {
  /** Task ID */
  taskId: string;
  /** Agent ID */
  agentId: string;
  /** Current status */
  status: "pending" | "running" | "completed" | "failed";
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step description */
  currentStep?: string;
  /** Estimated time remaining in ms */
  estimatedMsRemaining?: number;
}

/**
 * Summary of parallel execution
 */
export interface ExecutionSummary {
  /** Total tasks submitted */
  totalTasks: number;
  /** Tasks completed successfully */
  successful: number;
  /** Tasks that failed */
  failed: number;
  /** Tasks still pending */
  pending: number;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Per-task results */
  results: AgentTaskResult[];
  /** All progress updates */
  progressUpdates: TaskProgress[];
}

/**
 * Configuration for parallel execution
 */
export interface ParallelExecutionConfig {
  /** Maximum number of concurrent tasks */
  maxConcurrency?: number;
  /** Default timeout for tasks (ms) */
  defaultTimeout?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (progress: TaskProgress) => void;
  /** Whether to collect detailed timing info */
  collectTiming?: boolean;
}

/**
 * Agent executor interface
 * Implementations provide the actual agent execution mechanism
 */
export interface AgentExecutor {
  /**
   * Execute a single agent task
   */
  execute(task: AgentTask): Promise<unknown>;

  /**
   * Check if an agent is available
   */
  isAvailable(agentId: string): boolean;
}

/**
 * Dependency graph for tasks with dependencies
 */
export interface TaskGraph {
  /** All tasks in the graph */
  tasks: Map<string, AgentTask>;
  /** Adjacency list: task -> dependents */
  dependents: Map<string, Set<string>>;
  /** Adjacency list: task -> dependencies */
  dependencies: Map<string, Set<string>>;
}

/**
 * Execution layer - tasks that can run concurrently
 */
export interface ExecutionLayer {
  /** Layer number (0 = no dependencies) */
  layer: number;
  /** Tasks in this layer */
  tasks: AgentTask[];
  /** Tasks that can run immediately */
  readyTasks: AgentTask[];
}

/**
 * Parallel execution options
 */
export interface ParallelExecutionOptions extends ParallelExecutionConfig {
  /** Agent executor to use */
  executor: AgentExecutor;
  /** Whether to validate task graph before execution */
  validateGraph?: boolean;
}

/**
 * Error thrown when task graph has cycles
 */
export class CyclicDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Cyclic dependency detected: ${cycle.join(" -> ")}`);
    this.name = "CyclicDependencyError";
  }
}

/**
 * Error thrown when a task dependency is not found
 */
export class MissingDependencyError extends Error {
  constructor(public readonly taskId: string, public readonly dependencyId: string) {
    super(`Task '${taskId}' depends on non-existent task '${dependencyId}'`);
    this.name = "MissingDependencyError";
  }
}
