'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  isDev?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  cooldownRemaining: number;
}

const MAX_RETRIES = 3;
const COOLDOWN_SECONDS = 1;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private cooldownInterval: NodeJS.Timeout | null = null;
  // Track retry count as instance property to preserve it across errors
  private retryCount: number = 0;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      cooldownRemaining: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Only set hasError and error - retry tracking is handled by instance property
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  componentWillUnmount(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  private handleRetry = (): void => {
    // Prevent action if already in cooldown or max retries reached
    if (this.state.cooldownRemaining > 0 || this.retryCount >= MAX_RETRIES) {
      return;
    }

    // Clear any existing interval before starting new logic
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
      this.cooldownInterval = null;
    }

    this.retryCount += 1;

    // Check if retries are exhausted - show "Too Many Retries" UI
    if (this.retryCount >= MAX_RETRIES) {
      // Keep hasError true and show "Too Many Retries" UI; do not clear error
      this.setState({
        retryCount: this.retryCount,
        cooldownRemaining: 0,
      });
      return;
    }

    // For normal retries (not exhausted), start cooldown then retry
    this.setState({ cooldownRemaining: COOLDOWN_SECONDS });

    this.cooldownInterval = setInterval(() => {
      this.setState((prevState) => {
        if (prevState.cooldownRemaining <= 1) {
          // Cooldown finished - clear interval and attempt retry
          if (this.cooldownInterval) {
            clearInterval(this.cooldownInterval);
            this.cooldownInterval = null;
          }
          // Clear hasError to attempt re-rendering children
          return {
            hasError: false,
            error: null,
            cooldownRemaining: 0,
            retryCount: this.retryCount,
          };
        }
        // Decrement cooldown
        return { cooldownRemaining: prevState.cooldownRemaining - 1 };
      });
    }, 1000);
  };

  private handleReload = (): void => {
    // Reset the instance retry count
    this.retryCount = 0;
    this.setState({ hasError: false, error: null, retryCount: 0, cooldownRemaining: 0 });
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
      this.cooldownInterval = null;
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      const isDev = this.props.isDev ?? (process.env.NODE_ENV === 'development');
      const errorMessage = isDev
        ? this.state.error?.message || 'An unexpected error occurred'
        : 'An unexpected error occurred';

      if (this.retryCount >= MAX_RETRIES) {
        return (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">
              {errorMessage}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={true}
              >
                Too Many Retries
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={this.handleReload}
              >
                Reload Page
              </button>
            </div>
          </div>
        );
      }

      if (this.state.cooldownRemaining > 0) {
        return (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">
              {errorMessage}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={true}
              >
                Wait {this.state.cooldownRemaining}s
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={this.handleReload}
              >
                Reload Page
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-red-600 dark:text-red-300">
            {errorMessage}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={this.handleRetry}
            >
              Try Again (No Reload)
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={this.handleReload}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
