/**
 * Logger utility for E2E tests
 * Only prints when DEBUG=true environment variable is set
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMessage {
  level: LogLevel;
  message: string;
  emoji?: string;
  timestamp?: string;
}

class Logger {
  private isDebugEnabled: boolean;

  constructor() {
    this.isDebugEnabled = process.env.DEBUG === 'true';
  }

  private formatMessage({ level, message, emoji, timestamp }: LogMessage): string {
    const time = timestamp || new Date().toISOString();
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const levelPrefix = `[${level.toUpperCase()}]`;

    return `${levelPrefix} ${time} ${emojiPrefix}${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDebugEnabled) {
      return false;
    }

    // Allow error logs even when DEBUG is false for critical issues
    if (level === 'error') {
      return true;
    }

    return this.isDebugEnabled;
  }

  info(message: string, emoji?: string): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage({ level: 'info', message, emoji }));
    }
  }

  warn(message: string, emoji?: string): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage({ level: 'warn', message, emoji }));
    }
  }

  error(message: string, emoji?: string): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage({ level: 'error', message, emoji }));
    }
  }

  debug(message: string, emoji?: string): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage({ level: 'debug', message, emoji }));
    }
  }
}

// Export singleton instance
export const log = new Logger();

// Export the class for testing purposes
export { Logger };
