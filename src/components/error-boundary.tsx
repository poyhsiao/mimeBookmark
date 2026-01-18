"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  nextAllowedRetry: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      nextAllowedRetry: 0,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private retryTimeout: NodeJS.Timeout | null = null;

  public componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private handleRetry = (): void => {
    // First show confirm dialog, only proceed if user confirms
    const shouldReload = window.confirm(
      "An error occurred. Do you want to reload the page to try again?",
    );

    if (shouldReload) {
      // User confirmed - reload the page
      window.location.reload();
    }
    // If user cancelled, do nothing - don't reset state or re-render
  };

  private handleReset = (): void => {
    const COOLDOWN_MS = 1000;
    const nextAllowedRetry = Date.now() + COOLDOWN_MS;

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
      nextAllowedRetry,
    }));

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    this.retryTimeout = setTimeout(() => {
      this.forceUpdate();
    }, COOLDOWN_MS);
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI when error is caught
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className='flex flex-col items-center justify-center min-h-[400px] p-8 text-center'>
          <div className='max-w-md space-y-4'>
            <h2 className='text-2xl font-bold text-red-600'>
              Something went wrong
            </h2>
            <p className='text-gray-600'>
              An unexpected error occurred. Please try again.
            </p>
            {this.state.error && process.env.NODE_ENV !== "production" && (
              <details className='text-left text-sm text-gray-500 bg-gray-50 p-4 rounded'>
                <summary>Error details</summary>
                <pre className='mt-2 whitespace-pre-wrap'>
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className='flex gap-4 justify-center pt-4'>
              <Button onClick={this.handleRetry}>Reload Page</Button>
              <Button
                variant='outline'
                onClick={this.handleReset}
                disabled={
                  this.state.retryCount >= 3 ||
                  Date.now() < this.state.nextAllowedRetry
                }
              >
                {this.state.retryCount >= 3
                  ? "Too Many Retries"
                  : Date.now() < this.state.nextAllowedRetry
                    ? `Wait ${Math.ceil((this.state.nextAllowedRetry - Date.now()) / 1000)}s`
                    : "Try Again (No Reload)"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper function to create a wrapped error boundary for specific components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
): React.FC<P> {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
