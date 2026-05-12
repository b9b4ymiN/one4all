/**
 * Parallel Execution Module
 *
 * Executes multiple agents concurrently with proper coordination
 */

// Types
export * from "./types.js";

// Parallel Executor
export {
  ParallelExecutor,
  createParallelExecutor,
  MockAgentExecutor,
} from "./parallel-executor.js";
