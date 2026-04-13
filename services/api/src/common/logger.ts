import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  timestamp?: string;
  level: LogLevel;
  service?: string;
  module?: string;
  action?: string;
  requestId?: string;
  userId?: string;
  eventId?: string;
  errorCode?: string;
  message: string;
  meta?: Record<string, unknown>;
  stack?: string;
}

class Logger {
  private serviceName = 'event-platform-api';

  private log(level: LogLevel, message: string, context: Partial<LogContext> = {}) {
    const entry: LogContext = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...context,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        if (env.isDev) console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: Partial<LogContext>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Partial<LogContext>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Partial<LogContext>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: unknown, context?: Partial<LogContext>) {
    const errorContext = error instanceof Error
      ? { ...context, stack: error.stack, errorCode: context?.errorCode ?? 'INTERNAL_ERROR' }
      : context;
    this.log('error', message, errorContext);
  }
}

export const logger = new Logger();
