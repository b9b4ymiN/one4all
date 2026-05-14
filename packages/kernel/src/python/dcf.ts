/**
 * Python DCF Client
 *
 * Type-safe Python subprocess execution with timeout and graceful fallback
 */

import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import {
  PythonDCFResponse,
  PythonCallOptions,
  DCFCalculationParams,
  PythonResponseStatus
} from './types.js';
import { resolve, join } from 'path';

/**
 * Default options for Python execution
 */
const DEFAULT_OPTIONS: Required<Omit<PythonCallOptions, 'cwd'>> = {
  timeout: 30000, // 30 seconds
  retryOnTimeout: true,
  maxRetries: 2,
};

/**
 * Python DCF Client class
 */
export class PythonDCFClient {
  private pythonPath: string;
  private scriptPath: string;
  private defaultOptions: Required<Omit<PythonCallOptions, 'cwd'>> & { cwd?: string };

  constructor(options?: Partial<PythonCallOptions>) {
    this.pythonPath = 'python3';
    // Navigate from packages/kernel/src/python/dcf.ts to apps/quant/src/dcf.py
    // Use resolve to get absolute path relative to package root
    this.scriptPath = resolve(process.cwd(), 'apps/quant/src/dcf.py');
    this.defaultOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Calculate DCF valuation with timeout and retry logic
   */
  async calculateDCF(
    ticker: string,
    params: Omit<DCFCalculationParams, 'ticker'> = {}
  ): Promise<PythonDCFResponse> {
    const startTime = Date.now();
    const options = { ...this.defaultOptions };

    // Build command arguments
    const args = this.buildCommandArgs(ticker, params);

    // Execute with retry logic
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[DCF] Retry attempt ${attempt}/${options.maxRetries}`);
      }

      try {
        const result = await this.executeWithTimeout(args, options.timeout);
        const executionTime = Date.now() - startTime;

        return this.parseResponse(result, executionTime);
      } catch (error) {
        const executionTime = Date.now() - startTime;

        if (error instanceof Error && error.message === 'TIMEOUT') {
          console.log(`[DCF] Timeout after ${options.timeout}ms`);

          if (attempt < options.maxRetries && options.retryOnTimeout) {
            continue; // Retry
          }

          return {
            status: 'timeout',
            error: `Execution timeout after ${options.timeout}ms`,
            executionTime,
          };
        }

        return {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime,
        };
      }
    }

    return {
      status: 'error',
      error: 'Max retries exceeded',
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate DCF with graceful fallback to provided value
   */
  async calculateWithFallback(
    ticker: string,
    fallbackValue: number,
    params?: Omit<DCFCalculationParams, 'ticker'>
  ): Promise<PythonDCFResponse & { fair_value: number }> {
    const result = await this.calculateDCF(ticker, params);

    if (result.status === 'success' && result.data?.implied_share_price) {
      return {
        ...result,
        fair_value: result.data.implied_share_price,
      };
    }

    // Return fallback value on error/timeout
    console.log(`[DCF] Using fallback value ${fallbackValue} for ${ticker}`);
    return {
      ...result,
      status: 'success',
      data: {
        present_value: 0,
        terminal_value: 0,
        enterprise_value: 0,
        implied_share_price: fallbackValue,
      },
      fair_value: fallbackValue,
    };
  }

  /**
   * Execute Python command with timeout
   */
  private async executeWithTimeout(
    args: string[],
    timeoutMs: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let child: ChildProcess | null = null;
      let timeoutHandle: NodeJS.Timeout;

      // Set up timeout
      const timeoutPromise = new Promise<void>((_, timeoutReject) => {
        timeoutHandle = setTimeout(() => {
          if (child) {
            child.kill('SIGKILL');
          }
          timeoutReject(new Error('TIMEOUT'));
        }, timeoutMs);
      });

      // Set up process execution
      const processPromise = new Promise<string>((processResolve, processReject) => {
        try {
          child = spawn(this.pythonPath, [this.scriptPath, ...args], {
            cwd: this.defaultOptions.cwd,
          });

          child.stdout?.on('data', (data) => {
            output += data.toString();
          });

          child.stderr?.on('data', (data) => {
            errorOutput += data.toString();
          });

          child.on('close', (code) => {
            if (code === 0) {
              processResolve(output);
            } else {
              processReject(new Error(`Process exited with code ${code}: ${errorOutput}`));
            }
          });

          child.on('error', (error) => {
            processReject(new Error(`Failed to start process: ${error.message}`));
          });
        } catch (error) {
          processReject(error);
        }
      });

      // Race between timeout and process completion
      Promise.race([timeoutPromise, processPromise])
        .then((result) => {
          clearTimeout(timeoutHandle);
          resolve(result as string);
        })
        .catch((error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  /**
   * Parse Python script output
   */
  private parseResponse(
    output: string,
    executionTime: number
  ): PythonDCFResponse {
    try {
      // Extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          status: 'error',
          error: 'No valid JSON output found',
          executionTime,
        };
      }

      const data = JSON.parse(jsonMatch[0]);

      return {
        status: 'success',
        data: {
          present_value: data.present_value || 0,
          terminal_value: data.terminal_value || 0,
          enterprise_value: data.enterprise_value || 0,
          implied_share_price: data.implied_share_price,
        },
        executionTime,
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to parse output: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime,
      };
    }
  }

  /**
   * Build command arguments for Python script
   */
  private buildCommandArgs(
    ticker: string,
    params: Omit<DCFCalculationParams, 'ticker'>
  ): string[] {
    const args = ['--ticker', ticker];

    if (params.freeCashFlow !== undefined) {
      args.push('--free-cash-flow', params.freeCashFlow.toString());
    }
    if (params.discountRate !== undefined) {
      args.push('--wacc', params.discountRate.toString());
    }
    if (params.terminalGrowthRate !== undefined) {
      args.push('--terminal-growth', params.terminalGrowthRate.toString());
    }
    if (params.yearsToProject !== undefined) {
      args.push('--years', params.yearsToProject.toString());
    }
    if (params.netDebt !== undefined) {
      args.push('--net-debt', params.netDebt.toString());
    }
    if (params.sharesOutstanding !== undefined) {
      args.push('--shares', params.sharesOutstanding.toString());
    }
    if (params.growthRateYears) {
      for (const { rate, years } of params.growthRateYears) {
        args.push('--growth-stage', `${rate}:${years}`);
      }
    }

    return args;
  }
}
