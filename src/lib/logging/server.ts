import { getServerLogger } from "./logger";
import { createHash } from "crypto";

export interface LogErrorOptions {
  message?: string;
  context?: Record<string, unknown>;
  level?: "error" | "warn" | "info";
}

export async function logError(error: unknown, options: LogErrorOptions = {}): Promise<void> {
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

  const level = options.level || "error";

  const logContext: Record<string, unknown> = {
    ...options.context,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
  };

  // Only attach errorStack to logContext when NOT passing the Error object to logger.error
  // to avoid duplicating the stack trace (logger.error adds its own stack when given an Error)
  if (errorStack && level !== "error") {
    logContext.errorStack = errorStack;
  }

  switch (level) {
    case "error":
      await logger.error(
        errorMessage,
        error instanceof Error ? error : undefined,
        logContext,
      );
      break;
    case "warn":
      await logger.warn(errorMessage, logContext);
      break;
    case "info":
      await logger.info(errorMessage, logContext);
      break;
  }
}

export async function logApiError(
  error: unknown,
  requestPath: string,
  statusCode?: number,
): Promise<void> {
  await logError(error, {
    context: {
      requestPath,
      statusCode,
      source: "api",
    },
  });
}

export async function logDatabaseError(
  error: unknown,
  operation: string,
  tableName?: string,
): Promise<void> {
  await logError(error, {
    context: {
      operation,
      tableName,
      source: "database",
    },
  });
}

export async function logAuthenticationError(
  error: unknown,
  userId?: string,
  method?: string,
): Promise<void> {
  const displayUserId =
    userId && process.env.LOG_RAW_USER_IDS === "true"
      ? userId
      : userId
        ? anonymize(userId)
        : undefined;

  await logError(error, {
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

export async function logSecurityEvent(
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  const logger = getServerLogger();
  await logger.warn(message, {
    ...context,
    securityEvent: true,
  });
}
