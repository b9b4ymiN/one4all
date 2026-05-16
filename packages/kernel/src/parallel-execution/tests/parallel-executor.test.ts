/**
 * Parallel Executor Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ParallelExecutor,
  createParallelExecutor,
  MockAgentExecutor,
} from "../parallel-executor.js";
import type { AgentTask, AgentExecutor } from "../types.js";

describe("ParallelExecutor", () => {
  let executor: MockAgentExecutor;
  let parallel: ParallelExecutor;

  beforeEach(() => {
    executor = new MockAgentExecutor();
    parallel = createParallelExecutor(executor, {
      maxConcurrency: 3,
      defaultTimeout: 5000,
    });
  });

  describe("executeAll", () => {
    it("should execute single task", async () => {
      const tasks: AgentTask[] = [
        {
          id: "task1",
          agentId: "agent1",
          name: "Test Task 1",
          input: "Test input",
        },
      ];

      const results = await parallel.executeAll(tasks);

      expect(results).toHaveLength(1);
      expect(results[0].taskId).toBe("task1");
      expect(results[0].success).toBe(true);
      expect(results[0].agentId).toBe("agent1");
    });

    it("should execute multiple tasks in parallel", async () => {
      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input 1" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input 2" },
        { id: "task3", agentId: "agent3", name: "Task 3", input: "Input 3" },
      ];

      const results = await parallel.executeAll(tasks);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should respect concurrency limit", async () => {
      // Set different delays for each agent
      executor.setDelay("agent1", 200);
      executor.setDelay("agent2", 200);
      executor.setDelay("agent3", 200);
      executor.setDelay("agent4", 200);
      executor.setDelay("agent5", 200);

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input 1" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input 2" },
        { id: "task3", agentId: "agent3", name: "Task 3", input: "Input 3" },
        { id: "task4", agentId: "agent4", name: "Task 4", input: "Input 4" },
        { id: "task5", agentId: "agent5", name: "Task 5", input: "Input 5" },
      ];

      const startTime = Date.now();
      await parallel.executeAll(tasks);
      const elapsed = Date.now() - startTime;

      // With concurrency of 3 and 5 tasks taking 200ms each,
      // we should have at least 2 "batches" = ~400ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(400);
      expect(elapsed).toBeLessThan(600); // Should not take 1000ms (all sequential)
    });

    it("should handle task failures", async () => {
      executor.setFailure("agent2");

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input 1" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input 2" },
        { id: "task3", agentId: "agent3", name: "Task 3", input: "Input 3" },
      ];

      const results = await parallel.executeAll(tasks);

      expect(results).toHaveLength(3);

      // Find results by taskId since order may vary
      const task1Result = results.find((r) => r.taskId === "task1");
      const task2Result = results.find((r) => r.taskId === "task2");
      const task3Result = results.find((r) => r.taskId === "task3");

      expect(task1Result?.success).toBe(true);
      expect(task2Result?.success).toBe(false);
      expect(task2Result?.error).toContain("agent2");
      expect(task3Result?.success).toBe(true);
    });

    it("should include execution time", async () => {
      executor.setDelay("agent1", 150);

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input 1" },
      ];

      const results = await parallel.executeAll(tasks);

      expect(results[0].executionTime).toBeGreaterThanOrEqual(150);
    });
  });

  describe("execute with dependencies", () => {
    it("should execute tasks with dependencies in order", async () => {
      const executionOrder: string[] = [];

      const trackingExecutor: AgentExecutor = {
        async execute(task: AgentTask): Promise<unknown> {
          executionOrder.push(task.id);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { taskId: task.id };
        },
        isAvailable: () => true,
      };

      const trackingParallel = createParallelExecutor(trackingExecutor, {
        maxConcurrency: 3,
      });

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input 1" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input 2", dependsOn: ["task1"] },
        { id: "task3", agentId: "agent3", name: "Task 3", input: "Input 3", dependsOn: ["task2"] },
      ];

      await trackingParallel.execute(tasks);

      // task1 must complete before task2, task2 before task3
      const idx1 = executionOrder.indexOf("task1");
      const idx2 = executionOrder.indexOf("task2");
      const idx3 = executionOrder.indexOf("task3");

      expect(idx1).toBeLessThan(idx2);
      expect(idx2).toBeLessThan(idx3);
    });

    it("should execute independent tasks in parallel", async () => {
      const startTime = Date.now();

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input 1" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input 2" },
        { id: "task3", agentId: "agent3", name: "Task 3", input: "Input 3", dependsOn: ["task1"] },
      ];

      await parallel.execute(tasks);

      const elapsed = Date.now() - startTime;

      // task1 and task2 run in parallel, then task3 runs
      // So roughly 200ms (not 300ms sequential)
      expect(elapsed).toBeLessThan(300);
    });

    it("should handle diamond dependencies", async () => {
      const tasks: AgentTask[] = [
        { id: "root", agentId: "agent1", name: "Root", input: "Input" },
        { id: "branch1", agentId: "agent2", name: "Branch 1", input: "Input", dependsOn: ["root"] },
        { id: "branch2", agentId: "agent3", name: "Branch 2", input: "Input", dependsOn: ["root"] },
        { id: "leaf", agentId: "agent4", name: "Leaf", input: "Input", dependsOn: ["branch1", "branch2"] },
      ];

      const summary = await parallel.execute(tasks);

      expect(summary.totalTasks).toBe(4);
      expect(summary.successful).toBe(4);
      expect(summary.failed).toBe(0);
    });

    it("should detect cyclic dependencies", async () => {
      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input", dependsOn: ["task3"] },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input", dependsOn: ["task1"] },
        { id: "task3", agentId: "agent3", name: "Task 3", input: "Input", dependsOn: ["task2"] },
      ];

      await expect(parallel.execute(tasks)).rejects.toThrow("Cyclic dependency");
    });

    it("should detect missing dependencies", async () => {
      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input", dependsOn: ["nonexistent"] },
      ];

      await expect(parallel.execute(tasks)).rejects.toThrow("depends on non-existent");
    });
  });

  describe("progress tracking", () => {
    it("should report progress updates", async () => {
      const progressUpdates: string[] = [];

      const progressParallel = createParallelExecutor(executor, {
        maxConcurrency: 2,
        onProgress: (progress) => {
          progressUpdates.push(`${progress.taskId}:${progress.status}`);
        },
      });

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input" },
      ];

      await progressParallel.execute(tasks);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates).toContain("task1:running");
      expect(progressUpdates).toContain("task1:completed");
      expect(progressUpdates).toContain("task2:running");
      expect(progressUpdates).toContain("task2:completed");
    });

    it("should get task progress during execution", async () => {
      const slowExecutor = new MockAgentExecutor();
      slowExecutor.setDelay("agent1", 200);

      const slowParallel = createParallelExecutor(slowExecutor, {
        maxConcurrency: 1,
      });

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input" },
      ];

      // Don't await - let it run
      const execution = slowParallel.execute(tasks);

      // Check progress while running
      await new Promise((resolve) => setTimeout(resolve, 50));
      const progress = slowParallel.getProgress();

      expect(progress.length).toBe(2);
      expect(progress[0].taskId).toBe("task1");

      await execution;
    });

    it("should get progress for specific task", async () => {
      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
      ];

      await parallel.execute(tasks);

      const taskProgress = parallel.getTaskProgress("task1");
      expect(taskProgress).toBeDefined();
      expect(taskProgress?.taskId).toBe("task1");
      expect(taskProgress?.status).toBe("completed");
    });
  });

  describe("execution summary", () => {
    it("should build correct summary", async () => {
      executor.setFailure("agent2");

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input" },
        { id: "task3", agentId: "agent3", name: "Task 3", input: "Input" },
      ];

      const summary = await parallel.execute(tasks);

      expect(summary.totalTasks).toBe(3);
      expect(summary.successful).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.pending).toBe(0);
      expect(summary.totalExecutionTime).toBeGreaterThan(0);
      expect(summary.results).toHaveLength(3);
      expect(summary.progressUpdates).toHaveLength(3);
    });

    it("should include all task results in summary", async () => {
      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input" },
      ];

      const summary = await parallel.execute(tasks);

      expect(summary.results[0].taskId).toBe("task1");
      expect(summary.results[0].success).toBe(true);
      expect(summary.results[0].completedAt).toBeInstanceOf(Date);

      expect(summary.results[1].taskId).toBe("task2");
      expect(summary.results[1].success).toBe(true);
    });
  });

  describe("retry logic", () => {
    it("should retry failed tasks", async () => {
      const retryExecutor = new MockAgentExecutor();
      retryExecutor.setDelay("agent1", 50);

      let attemptCount = 0;
      const flakyExecutor: AgentExecutor = {
        async execute(task: AgentTask): Promise<unknown> {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error("Temporary failure");
          }
          return { success: true };
        },
        isAvailable: () => true,
      };

      const retryParallel = createParallelExecutor(flakyExecutor);

      const tasks: AgentTask[] = [
        {
          id: "task1",
          agentId: "agent1",
          name: "Task 1",
          input: "Input",
          retry: { maxAttempts: 3, backoffMs: 10 },
        },
      ];

      const results = await retryParallel.executeAll(tasks);

      expect(results[0].success).toBe(true);
      expect(results[0].retries).toBe(2);
    });

    it("should fail after max retries exceeded", async () => {
      const failingExecutor: AgentExecutor = {
        async execute(): Promise<unknown> {
          throw new Error("Always fails");
        },
        isAvailable: () => true,
      };

      const retryParallel = createParallelExecutor(failingExecutor);

      const tasks: AgentTask[] = [
        {
          id: "task1",
          agentId: "agent1",
          name: "Task 1",
          input: "Input",
          retry: { maxAttempts: 2, backoffMs: 10 },
        },
      ];

      const results = await retryParallel.executeAll(tasks);

      expect(results[0].success).toBe(false);
      expect(results[0].retries).toBe(2);
      expect(results[0].error).toContain("Always fails");
    });
  });

  describe("timeout handling", () => {
    it("should timeout long-running tasks", async () => {
      const slowExecutor: AgentExecutor = {
        async execute(): Promise<unknown> {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return { done: true };
        },
        isAvailable: () => true,
      };

      const timeoutParallel = createParallelExecutor(slowExecutor, {
        defaultTimeout: 100,
      });

      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
      ];

      const results = await timeoutParallel.executeAll(tasks);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain("timed out");
    });
  });

  describe("getResults", () => {
    it("should return collected results", async () => {
      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input" },
      ];

      await parallel.execute(tasks);

      const results = parallel.getResults();

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should get specific task result", async () => {
      const tasks: AgentTask[] = [
        { id: "task1", agentId: "agent1", name: "Task 1", input: "Input" },
        { id: "task2", agentId: "agent2", name: "Task 2", input: "Input" },
      ];

      await parallel.execute(tasks);

      const result1 = parallel.getTaskResult("task1");
      const result2 = parallel.getTaskResult("task2");

      expect(result1?.taskId).toBe("task1");
      expect(result2?.taskId).toBe("task2");
    });
  });

  describe("MockAgentExecutor", () => {
    it("should execute tasks and return output", async () => {
      const mock = new MockAgentExecutor();

      const result = await mock.execute({
        id: "test",
        agentId: "test-agent",
        name: "Test",
        input: "Input",
      });

      expect(result).toBeDefined();
      expect((result as any).agentId).toBe("test-agent");
    });

    it("should respect set delays", async () => {
      const mock = new MockAgentExecutor();
      mock.setDelay("agent1", 150);

      const start = Date.now();
      await mock.execute({
        id: "test",
        agentId: "agent1",
        name: "Test",
        input: "Input",
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(140); // Allow small timing variance
    });

    it("should fail when set to fail", async () => {
      const mock = new MockAgentExecutor();
      mock.setFailure("agent1");

      await expect(
        mock.execute({
          id: "test",
          agentId: "agent1",
          name: "Test",
          input: "Input",
        })
      ).rejects.toThrow();
    });

    it("should report availability correctly", () => {
      const mock = new MockAgentExecutor();

      expect(mock.isAvailable("agent1")).toBe(true);

      mock.setFailure("agent1");
      expect(mock.isAvailable("agent1")).toBe(false);
    });
  });
});
