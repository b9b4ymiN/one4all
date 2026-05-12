/**
 * Parallel Executor
 *
 * Executes multiple agents concurrently with proper coordination,
 * dependency management, and result aggregation
 */

import {
  AgentTask,
  AgentTaskResult,
  AgentExecutor,
  ParallelExecutionOptions,
  ParallelExecutionConfig,
  ExecutionSummary,
  TaskProgress,
  TaskGraph,
  ExecutionLayer,
  CyclicDependencyError,
  MissingDependencyError,
} from "./types.js";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  maxConcurrency: 5,
  defaultTimeout: 300000, // 5 minutes
  continueOnError: true,
  collectTiming: true,
  onProgress: (_progress: TaskProgress) => {
    // No-op default
  },
} as const;

/**
 * Parallel Executor class
 */
export class ParallelExecutor {
  private executor: AgentExecutor;
  private config: Required<ParallelExecutionConfig>;
  private results: Map<string, AgentTaskResult> = new Map();
  private progress: Map<string, TaskProgress> = new Map();
  private startTime: number = 0;

  constructor(executor: AgentExecutor, config: ParallelExecutionConfig = {}) {
    this.executor = executor;
    this.config = {
      maxConcurrency: config.maxConcurrency ?? DEFAULT_CONFIG.maxConcurrency,
      defaultTimeout: config.defaultTimeout ?? DEFAULT_CONFIG.defaultTimeout,
      continueOnError: config.continueOnError ?? DEFAULT_CONFIG.continueOnError,
      onProgress: config.onProgress ?? DEFAULT_CONFIG.onProgress,
      collectTiming: config.collectTiming ?? DEFAULT_CONFIG.collectTiming,
    };
  }

  /**
   * Execute multiple tasks in parallel
   */
  async execute(tasks: AgentTask[]): Promise<ExecutionSummary> {
    this.startTime = Date.now();
    this.results.clear();
    this.progress.clear();

    // Initialize progress tracking
    for (const task of tasks) {
      this.progress.set(task.id, {
        taskId: task.id,
        agentId: task.agentId,
        status: "pending",
        progress: 0,
      });
    }

    // Build task graph for dependency resolution
    const graph = this.buildTaskGraph(tasks);

    // Validate for cycles
    this.validateGraph(graph);

    // Calculate execution layers
    const layers = this.calculateLayers(graph);

    // Execute each layer
    for (const layer of layers) {
      await this.executeLayer(layer);
    }

    return this.buildSummary(tasks.length);
  }

  /**
   * Execute tasks with options
   */
  async executeWithOptions(
    tasks: AgentTask[],
    options: ParallelExecutionOptions
  ): Promise<ExecutionSummary> {
    const originalExecutor = this.executor;
    const originalConfig = this.config;

    this.executor = options.executor;
    Object.assign(this.config, options);

    try {
      return await this.execute(tasks);
    } finally {
      this.executor = originalExecutor;
      Object.assign(this.config, originalConfig);
    }
  }

  /**
   * Execute tasks without dependencies (simple parallel execution)
   */
  async executeAll(tasks: AgentTask[]): Promise<AgentTaskResult[]> {
    const results = await this.executeTasksWithConcurrency(tasks);
    return results;
  }

  /**
   * Get current progress for all tasks
   */
  getProgress(): TaskProgress[] {
    return Array.from(this.progress.values());
  }

  /**
   * Get progress for a specific task
   */
  getTaskProgress(taskId: string): TaskProgress | undefined {
    return this.progress.get(taskId);
  }

  /**
   * Get results collected so far
   */
  getResults(): AgentTaskResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Get result for a specific task
   */
  getTaskResult(taskId: string): AgentTaskResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Build task dependency graph
   */
  private buildTaskGraph(tasks: AgentTask[]): TaskGraph {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const dependents = new Map<string, Set<string>>();
    const dependencies = new Map<string, Set<string>>();

    // Initialize all task IDs in the maps first
    for (const task of tasks) {
      dependents.set(task.id, new Set());
      dependencies.set(task.id, new Set());
    }

    // Then populate dependencies
    for (const task of tasks) {
      if (task.dependsOn) {
        for (const depId of task.dependsOn) {
          // Validate dependency exists
          if (!taskMap.has(depId)) {
            throw new MissingDependencyError(task.id, depId);
          }
          dependents.get(depId)!.add(task.id);
          dependencies.get(task.id)!.add(depId);
        }
      }
    }

    return {
      tasks: taskMap,
      dependents,
      dependencies,
    };
  }

  /**
   * Validate task graph for cycles
   */
  private validateGraph(graph: TaskGraph): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): boolean => {
      if (visiting.has(taskId)) {
        // Found a cycle
        const cycleStart = path.indexOf(taskId);
        throw new CyclicDependencyError([...path.slice(cycleStart), taskId]);
      }

      if (visited.has(taskId)) {
        return false;
      }

      visiting.add(taskId);
      path.push(taskId);

      for (const depId of graph.dependencies.get(taskId) || []) {
        dfs(depId);
      }

      path.pop();
      visiting.delete(taskId);
      visited.add(taskId);
      return false;
    };

    for (const taskId of graph.tasks.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }
  }

  /**
   * Calculate execution layers based on dependencies
   */
  private calculateLayers(graph: TaskGraph): ExecutionLayer[] {
    const layers: ExecutionLayer[] = [];
    const processed = new Set<string>();
    const inDegree = new Map<string, number>();

    // Calculate in-degrees
    for (const [taskId, deps] of graph.dependencies.entries()) {
      inDegree.set(taskId, deps.size);
    }

    // Tasks with no dependencies go in layer 0
    const queue: string[] = [];
    for (const taskId of graph.tasks.keys()) {
      if ((inDegree.get(taskId) || 0) === 0) {
        queue.push(taskId);
      }
    }

    let layerNum = 0;
    while (queue.length > 0) {
      const layerSize = queue.length;
      const layerTasks: AgentTask[] = [];

      for (let i = 0; i < layerSize; i++) {
        const taskId = queue.shift()!;
        const task = graph.tasks.get(taskId)!;
        layerTasks.push(task);
        processed.add(taskId);

        // Reduce in-degree for dependents
        for (const depId of graph.dependents.get(taskId) || []) {
          const newDegree = (inDegree.get(depId) || 0) - 1;
          inDegree.set(depId, newDegree);
          if (newDegree === 0) {
            queue.push(depId);
          }
        }
      }

      layers.push({
        layer: layerNum,
        tasks: layerTasks,
        readyTasks: layerTasks,
      });
      layerNum++;
    }

    return layers;
  }

  /**
   * Execute a single layer of tasks
   */
  private async executeLayer(layer: ExecutionLayer): Promise<void> {
    const results = await this.executeTasksWithConcurrency(layer.readyTasks);

    for (const result of results) {
      this.results.set(result.taskId, result);

      if (!result.success && !this.config.continueOnError) {
        throw new Error(`Task '${result.taskId}' failed: ${result.error}`);
      }
    }
  }

  /**
   * Execute tasks with concurrency limit
   */
  private async executeTasksWithConcurrency(
    tasks: AgentTask[]
  ): Promise<AgentTaskResult[]> {
    const results: AgentTaskResult[] = [];
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const promise = this.executeTask(task).then((result) => {
        results.push(result);
      });

      executing.push(promise);

      // Throttle concurrency
      if (executing.length >= this.config.maxConcurrency) {
        await Promise.race(executing);
        // Remove completed promises
        const settled = await Promise.allSettled(executing);
        executing.length = 0;
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: AgentTask): Promise<AgentTaskResult> {
    const startTime = Date.now();
    let retries = 0;
    const maxRetries = task.retry?.maxAttempts ?? 0;

    this.updateProgress(task.id, "running", 0, "Starting task");

    try {
      // Check agent availability
      if (!this.executor.isAvailable(task.agentId)) {
        throw new Error(`Agent '${task.agentId}' is not available`);
      }

      // Execute with retry logic
      let lastError: Error | undefined;
      while (retries <= maxRetries) {
        try {
          const output = await this.withTimeout(
            this.executor.execute(task),
            task.timeout ?? this.config.defaultTimeout
          );

          const executionTime = Date.now() - startTime;
          const result: AgentTaskResult = {
            taskId: task.id,
            agentId: task.agentId,
            success: true,
            output,
            executionTime,
            completedAt: new Date(),
            retries,
          };

          this.updateProgress(task.id, "completed", 100, "Completed");
          return result;
        } catch (error) {
          lastError = error as Error;

          // Only increment retries if we will retry again
          if (retries < maxRetries) {
            retries++;
            const backoff = task.retry?.backoffMs ?? 1000;
            this.updateProgress(task.id, "running", 50, `Retrying (${retries}/${maxRetries})`);
            await this.sleep(backoff * retries);
          } else {
            // This was the last attempt, break without incrementing
            break;
          }
        }
      }

      throw lastError;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: AgentTaskResult = {
        taskId: task.id,
        agentId: task.agentId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        completedAt: new Date(),
        retries,
      };

      this.updateProgress(task.id, "failed", 0, "Failed");
      return result;
    }
  }

  /**
   * Wrap a promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Update task progress
   */
  private updateProgress(
    taskId: string,
    status: TaskProgress["status"],
    progress: number,
    currentStep?: string
  ): void {
    const existing = this.progress.get(taskId);
    const updated: TaskProgress = {
      taskId,
      agentId: existing?.agentId ?? "",
      status,
      progress,
      currentStep,
    };

    this.progress.set(taskId, updated);

    if (this.config.onProgress) {
      this.config.onProgress(updated);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build execution summary
   */
  private buildSummary(totalTasks: number): ExecutionSummary {
    const resultsArray = Array.from(this.results.values());
    const successful = resultsArray.filter((r) => r.success).length;
    const failed = resultsArray.filter((r) => !r.success).length;
    const totalExecutionTime = Date.now() - this.startTime;

    return {
      totalTasks,
      successful,
      failed,
      pending: totalTasks - resultsArray.length,
      totalExecutionTime,
      results: resultsArray,
      progressUpdates: Array.from(this.progress.values()),
    };
  }
}

/**
 * Create a parallel executor
 */
export function createParallelExecutor(
  executor: AgentExecutor,
  config?: ParallelExecutionConfig
): ParallelExecutor {
  return new ParallelExecutor(executor, config);
}

/**
 * Simple mock agent executor for testing
 */
export class MockAgentExecutor implements AgentExecutor {
  private delays: Map<string, number> = new Map();
  private failures: Set<string> = new Set();

  setDelay(agentId: string, ms: number): void {
    this.delays.set(agentId, ms);
  }

  setFailure(agentId: string): void {
    this.failures.add(agentId);
  }

  async execute(task: AgentTask): Promise<unknown> {
    const delay = this.delays.get(task.agentId) ?? 100;

    if (this.failures.has(task.agentId)) {
      throw new Error(`Agent '${task.agentId}' failed`);
    }

    await this.sleep(delay);

    return {
      agentId: task.agentId,
      taskId: task.id,
      output: `Mock output from ${task.agentId}`,
      timestamp: new Date().toISOString(),
    };
  }

  isAvailable(agentId: string): boolean {
    return !this.failures.has(agentId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
