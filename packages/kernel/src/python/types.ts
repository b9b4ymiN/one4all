/**
 * Python Integration Type Definitions
 *
 * Type-safe interfaces for Python subprocess execution
 */

/**
 * Response status from Python execution
 */
export type PythonResponseStatus = 'success' | 'error' | 'timeout';

/**
 * Standard response format from Python scripts
 */
export interface PythonDCFResponse {
  /** Response status */
  status: PythonResponseStatus;
  /** Response data if successful */
  data?: {
    present_value: number;
    terminal_value: number;
    enterprise_value: number;
    implied_share_price?: number;
  };
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Options for Python execution
 */
export interface PythonCallOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to retry on timeout (default: true) */
  retryOnTimeout?: boolean;
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number;
  /** Working directory for command execution */
  cwd?: string;
}

/**
 * DCF calculation parameters
 */
export interface DCFCalculationParams {
  ticker: string;
  freeCashFlow?: number;
  discountRate?: number;
  terminalGrowthRate?: number;
  yearsToProject?: number;
  growthRateYears?: Array<{ rate: number; years: number }>;
  netDebt?: number;
  sharesOutstanding?: number;
}
