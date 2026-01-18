import { getServerLogger } from "./logger";
import { createHash } from "crypto";

export interface LogErrorOptions {
  message?: string;
  context?: Record<string, unknown>;
  level?: "error" | "warn" | "info";
}

export function logError(error: unknown, options: LogErrorOptions = {}): void {
  const logger = getServerLogger();

  let errorMessage: string;
  let errorStack: string | undefined;

  if (error instanceof Error) {
    errorMessage = options.message || error.message;
    errorStack = error.stack;
  } else {
    errorMessage = options.message || String(error);
    errorStack = undefined;
  }

  const logContext: Record<string, unknown> = {
    ...options.context,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
  };

  if (errorStack) {
    logContext.errorStack = errorStack;
  }

  // Use the specified level or default to 'error'
  const level = options.level || "error";

  switch (level) {
    case "error":
      logger.error(
        errorMessage,
        error instanceof Error ? error : undefined,
        logContext,
      );
      break;
    case "warn":
      logger.warn(errorMessage, logContext);
      break;
    case "info":
      logger.info(errorMessage, logContext);
      break;
  }
}

export function logApiError(
  error: unknown,
  requestPath: string,
  statusCode?: number,
): void {
  logError(error, {
    context: {
      requestPath,
      statusCode,
      source: "api",
    },
  });
}

export function logDatabaseError(
  error: unknown,
  operation: string,
  tableName?: string,
): void {
  logError(error, {
    context: {
      operation,
      tableName,
      source: "database",
    },
  });
}

export function logAuthenticationError(
  error: unknown,
  userId?: string,
  method?: string,
): void {
  const displayUserId =
    userId && process.env.LOG_RAW_USER_IDS === "true"
      ? userId
      : userId
        ? anonymize(userId)
        : undefined;

  logError(error, {
    context: {
      userId: displayUserId,
      method,
      source: "authentication",
    },
  });
}

/**
 * Anonymizes a string using SHA-256 hash.
 */
function anonymize(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

export function logSecurityEvent(
  message: string,
  context?: Record<string, unknown>,
): void {
  const logger = getServerLogger();
  logger.warn(message, {
    ...context,
    securityEvent: true,
  });
}
