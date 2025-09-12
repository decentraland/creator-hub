export interface ErrorContext {
  provider?: string;
  transaction?: string;
  operation?: string;
  component?: string;
  entity?: number;
}

export class StateManagerError extends Error {
  constructor(
    message: string,
    public readonly context: ErrorContext,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'StateManagerError';
  }
}

export class ErrorHandler {
  private static formatContext(context: ErrorContext): string {
    const parts = [];
    if (context.provider) parts.push(`provider:${context.provider}`);
    if (context.transaction) parts.push(`tx:${context.transaction.slice(0, 8)}`);
    if (context.operation) parts.push(`op:${context.operation}`);
    if (context.component) parts.push(`comp:${context.component}`);
    if (context.entity !== undefined) parts.push(`entity:${context.entity}`);
    return parts.join(' ');
  }

  static handleError(message: string, context: ErrorContext, error?: Error): void {
    const contextStr = this.formatContext(context);
    const fullMessage = `${message} [${contextStr}]`;

    if (error) {
      console.error(fullMessage, error);
    } else {
      console.error(fullMessage);
    }
  }

  static createError(
    message: string,
    context: ErrorContext,
    originalError?: Error,
  ): StateManagerError {
    return new StateManagerError(message, context, originalError);
  }
}
