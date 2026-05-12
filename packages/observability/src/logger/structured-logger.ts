/**
 * Structured Logger - Winston-based logging with context tracking
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

export interface LogContext {
  missionId?: string;
  agentId?: string;
  phase?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  level?: LogLevel;
  silent?: boolean;
  logDir?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableDailyRotate?: boolean;
  format?: 'json' | 'pretty';
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  silent: false,
  logDir: './logs',
  enableConsole: true,
  enableFile: true,
  enableDailyRotate: true,
  format: 'json',
};

export class StructuredLogger {
  private logger: winston.Logger;
  private context: LogContext;

  constructor(config: LoggerConfig = {}, baseContext: LogContext = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    this.context = baseContext;

    const transports: winston.transport[] = [];

    if (finalConfig.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              const contextStr = Object.keys(meta).length > 0
                ? ` ${JSON.stringify(meta)}`
                : '';
              return `${timestamp} [${level}]: ${message}${contextStr}`;
            })
          ),
        })
      );
    }

    if (finalConfig.enableFile) {
      if (finalConfig.enableDailyRotate) {
        transports.push(
          new DailyRotateFile({
            dirname: finalConfig.logDir!,
            filename: 'application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          })
        );

        transports.push(
          new DailyRotateFile({
            dirname: finalConfig.logDir!,
            filename: 'error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '30d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          })
        );
      } else {
        transports.push(
          new winston.transports.File({
            dirname: finalConfig.logDir!,
            filename: 'combined.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          })
        );
      }
    }

    this.logger = winston.createLogger({
      level: finalConfig.level,
      silent: finalConfig.silent,
      transports,
      exitOnError: false,
    });
  }

  withContext(additionalContext: LogContext): StructuredLogger {
    const newLogger = new StructuredLogger({}, { ...this.context, ...additionalContext });
    newLogger.logger = this.logger;
    return newLogger;
  }

  updateContext(contextUpdates: Partial<LogContext>): void {
    this.context = { ...this.context, ...contextUpdates };
  }

  private formatMessage(message: string, meta?: Record<string, unknown>): string {
    return message;
  }

  private buildMeta(additionalMeta?: Record<string, unknown>): Record<string, unknown> {
    const meta: Record<string, unknown> = {};

    if (Object.keys(this.context).length > 0) {
      meta.context = this.context;
    }

    if (additionalMeta) {
      meta.metadata = additionalMeta;
    }

    return meta;
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorMeta = this.buildMeta(meta);

    if (error instanceof Error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as NodeJS.ErrnoException).code,
      };
    } else if (error) {
      errorMeta.error = {
        name: 'UnknownError',
        message: String(error),
      };
    }

    this.logger.error(this.formatMessage(message, errorMeta), errorMeta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(this.formatMessage(message, meta), this.buildMeta(meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(this.formatMessage(message, meta), this.buildMeta(meta));
  }

  http(message: string, meta?: Record<string, unknown>): void {
    this.logger.http(this.formatMessage(message, meta), this.buildMeta(meta));
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.logger.verbose(this.formatMessage(message, meta), this.buildMeta(meta));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(this.formatMessage(message, meta), this.buildMeta(meta));
  }

  silly(message: string, meta?: Record<string, unknown>): void {
    this.logger.silly(this.formatMessage(message, meta), this.buildMeta(meta));
  }

  logMissionTransition(
    missionId: string,
    fromState: string,
    toState: string,
    meta?: Record<string, unknown>
  ): void {
    this.withContext({ missionId }).info(
      `Mission state transition: ${fromState} -> ${toState}`,
      {
        event: 'mission_transition',
        fromState,
        toState,
        ...meta,
      }
    );
  }

  logAgentAction(
    missionId: string,
    agentId: string,
    action: string,
    meta?: Record<string, unknown>
  ): void {
    this.withContext({ missionId, agentId }).info(
      `Agent action: ${action}`,
      {
        event: 'agent_action',
        action,
        ...meta,
      }
    );
  }

  logConstitutionViolation(
    missionId: string,
    ruleId: string,
    severity: string,
    description: string,
    meta?: Record<string, unknown>
  ): void {
    this.withContext({ missionId }).warn(
      `Constitution violation: ${ruleId} - ${description}`,
      {
        event: 'constitution_violation',
        ruleId,
        severity,
        description,
        ...meta,
      }
    );
  }

  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  getLevel(): string {
    return this.logger.level;
  }

  close(): void {
    this.logger.close();
  }

  getChildLogger(childContext: LogContext): StructuredLogger {
    return this.withContext(childContext);
  }
}
