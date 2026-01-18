import { render, screen, fireEvent, act } from "@testing-library/react";
import { ErrorBoundary } from "../error-boundary";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";

const ThrowError = ({
  message,
  shouldThrow = true,
}: {
  message?: string;
  shouldThrow?: boolean;
}) => {
  if (shouldThrow) {
    throw new Error(message || "Test error");
  }
  return <div>Success Content</div>;
};

describe("ErrorBoundary", () => {
  // Prevent console.error from cluttering the test output
  vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Test Content")).toBeTruthy();
  });

  it("renders error message in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(
      <ErrorBoundary>
        <ThrowError message='Sensitive dev error' />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Sensitive dev error")).toBeTruthy();
  });

  it("hides sensitive error message in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <ErrorBoundary>
        <ThrowError message='Sensitive production error' />
      </ErrorBoundary>,
    );

    // It should not display the specific error message
    expect(screen.queryByText("Sensitive production error")).toBeNull();
  });

  describe("Retry Logic", () => {
    it("should limit the number of retries for deterministic errors", () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );

      // Initial error shown
      expect(screen.getByText("Something went wrong")).toBeTruthy();
      const retryButton = screen.getByText("Try Again (No Reload)");

      // Retry 1
      fireEvent.click(retryButton);
      expect(screen.getByText("Something went wrong")).toBeTruthy();

      // Advance time to clear cooldown
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Retry 2
      fireEvent.click(screen.getByText("Try Again (No Reload)"));
      expect(screen.getByText("Something went wrong")).toBeTruthy();

      // Advance time to clear cooldown
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Retry 3 (max is 3)
      fireEvent.click(screen.getByText("Try Again (No Reload)"));
      expect(screen.getByText("Something went wrong")).toBeTruthy();

      // After max retries, the button should be disabled
      const disabledButton = screen.getByText("Too Many Retries");
      expect(disabledButton).toBeDisabled();
    });

    it("should enforce a cooldown period between retries", () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );

      const retryButton = screen.getByText("Try Again (No Reload)");

      // First retry
      fireEvent.click(retryButton);

      // Immediately after, it should be disabled due to cooldown
      expect(screen.getByText(/Wait \d+s/)).toBeDisabled();

      // Advance time by 1s
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should be enabled again
      expect(screen.getByText("Try Again (No Reload)")).not.toBeDisabled();
    });
  });
});
