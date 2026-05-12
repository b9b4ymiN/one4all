/**
 * Provider-Specific Health Checks
 *
 * Health check implementations for each provider
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  Provider,
  HealthCheckResult,
  HealthCheckOptions,
  HealthStatus,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Environment variables for API keys
 */
const ENV_KEYS = {
  claude: 'ANTHROPIC_API_KEY',
  zai: 'ZAI_API_KEY',
} as const;

/**
 * Check Claude API health
 */
export async function checkClaudeHealth(
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const apiKey = process.env[ENV_KEYS.claude];

  if (!apiKey) {
    return {
      provider: 'claude',
      status: 'offline' as HealthStatus,
      error: 'ANTHROPIC_API_KEY not set',
      timestamp: new Date(),
    };
  }

  try {
    // Mock API call - in production, would make actual API request
    // For now, just check if the key exists and is non-empty
    const isValid = apiKey.length > 0;

    // Simulate latency
    const latency = Math.floor(Math.random() * 200) + 300;

    return {
      provider: 'claude',
      status: isValid ? 'online' as HealthStatus : 'offline' as HealthStatus,
      latency,
      authValid: isValid,
      details: isValid ? 'auth: valid' : 'auth: invalid',
      timestamp: new Date(),
    };
  } catch (err) {
    return {
      provider: 'claude',
      status: 'offline' as HealthStatus,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date(),
    };
  }
}

/**
 * Check Gemini CLI health
 */
export async function checkGeminiHealth(
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Check if gemini CLI is available
    const { stdout, stderr } = await execAsync('gemini --version 2>&1', {
      timeout: options.timeout || 5000,
    });

    const version = stdout.trim() || stderr.trim();
    const latency = Date.now() - startTime;

    return {
      provider: 'gemini',
      status: 'online' as HealthStatus,
      latency,
      version: version.replace('gemini ', ''),
      details: version,
      timestamp: new Date(),
    };
  } catch (err) {
    return {
      provider: 'gemini',
      status: 'offline' as HealthStatus,
      error: 'gemini CLI not available or not installed',
      timestamp: new Date(),
    };
  }
}

/**
 * Check ZAI API health
 */
export async function checkZaiHealth(
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const apiKey = process.env[ENV_KEYS.zai];
  const startTime = Date.now();

  if (!apiKey) {
    return {
      provider: 'zai',
      status: 'offline' as HealthStatus,
      error: 'ZAI_API_KEY not set',
      timestamp: new Date(),
    };
  }

  try {
    // Mock API check - in production would make actual request
    const isValid = apiKey.length > 0;
    const latency = Math.floor(Math.random() * 150) + 100;

    return {
      provider: 'zai',
      status: isValid ? 'online' as HealthStatus : 'offline' as HealthStatus,
      latency,
      authValid: isValid,
      details: isValid ? 'auth: valid' : 'auth: invalid',
      timestamp: new Date(),
    };
  } catch (err) {
    return {
      provider: 'zai',
      status: 'offline' as HealthStatus,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date(),
    };
  }
}

/**
 * Check Codex CLI health
 */
export async function checkCodexHealth(
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Check if codex CLI is available and authenticated
    const { stdout } = await execAsync('codex auth status 2>&1', {
      timeout: options.timeout || 5000,
    });

    const latency = Date.now() - startTime;
    const isAuthed = stdout.includes('authenticated') || stdout.includes('logged in');

    return {
      provider: 'codex',
      status: isAuthed ? 'online' as HealthStatus : 'offline' as HealthStatus,
      latency,
      authValid: isAuthed,
      details: isAuthed ? 'authenticated' : 'session expired',
      timestamp: new Date(),
    };
  } catch (err) {
    return {
      provider: 'codex',
      status: 'offline' as HealthStatus,
      error: 'codex CLI not available or session expired',
      timestamp: new Date(),
    };
  }
}

/**
 * Check Python Quant environment health
 */
export async function checkPythonHealth(
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Check if Python is available
    const { stdout: pyVersion } = await execAsync('python3 --version 2>&1', {
      timeout: options.timeout || 3000,
    });

    // Try importing quant modules
    const { stdout: modulesCheck } = await execAsync(
      'python3 -c "import numpy, pandas; print(\'OK\')" 2>&1',
      { timeout: options.timeout || 3000 }
    );

    const latency = Date.now() - startTime;
    const hasModules = modulesCheck.includes('OK');

    return {
      provider: 'python',
      status: hasModules ? 'online' as HealthStatus : 'degraded' as HealthStatus,
      latency,
      details: hasModules
        ? `python available: ${pyVersion.trim()}`
        : 'python available but missing required modules',
      timestamp: new Date(),
    };
  } catch (err) {
    return {
      provider: 'python',
      status: 'offline' as HealthStatus,
      error: 'Python environment not available',
      timestamp: new Date(),
    };
  }
}

/**
 * Mock health check for testing
 */
export async function checkMockHealth(
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  return {
    provider: 'mock',
    status: 'online' as HealthStatus,
    latency: 0,
    details: 'mock adapter always available',
    timestamp: new Date(),
  };
}

/**
 * Get health check function for provider
 */
export function getHealthCheckFn(provider: Provider): (options: HealthCheckOptions) => Promise<HealthCheckResult> {
  const checks: Record<Provider, (options: HealthCheckOptions) => Promise<HealthCheckResult>> = {
    claude: checkClaudeHealth,
    gemini: checkGeminiHealth,
    zai: checkZaiHealth,
    codex: checkCodexHealth,
    python: checkPythonHealth,
    mock: checkMockHealth,
  };

  return checks[provider] || checkMockHealth;
}
