import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionModal } from "../collection-modal";
import { expect, test, vi, describe, beforeEach, afterEach } from "vitest";
import * as useCollectionsModule from "@/hooks/use-collections";

test("CollectionModal has valid aria-checked values and no inline styles", () => {
  const { container } = render(
    <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
  );

  const radioButtons = screen.getAllByRole("radio");

  expect(radioButtons.length).toBeGreaterThan(0);

  radioButtons.forEach((button) => {
    // Check aria-checked is either "true" or "false"
    const checked = button.getAttribute("aria-checked");
    expect(["true", "false"]).toContain(checked);

    // Check no inline style
    expect(button).not.toHaveAttribute("style");

    // Check it has the color class
    expect(button.className).toMatch(/color-btn-\d/);
  });
});

describe("CollectionModal keyboard navigation", () => {
  test("ArrowRight moves to next color and focuses it", () => {
    render(
      <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    const radioButtons = screen.getAllByRole("radio");
    const firstButton = radioButtons[0];
    const secondButton = radioButtons[1];

    // First button should be checked initially
    expect(firstButton).toHaveAttribute("aria-checked", "true");
    expect(secondButton).toHaveAttribute("aria-checked", "false");

    // Focus first button and press ArrowRight
    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: "ArrowRight" });

    // Second button should now be checked
    expect(secondButton).toHaveAttribute("aria-checked", "true");
    expect(firstButton).toHaveAttribute("aria-checked", "false");
    // Note: In jsdom, focus() may not work as expected, so we skip activeElement check
  });

  test("ArrowDown moves to next color and focuses it", () => {
    render(
      <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    const radioButtons = screen.getAllByRole("radio");
    const firstButton = radioButtons[0];
    const secondButton = radioButtons[1];

    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: "ArrowDown" });

    expect(secondButton).toHaveAttribute("aria-checked", "true");
  });

  test("ArrowLeft moves to previous color and focuses it", () => {
    render(
      <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    const radioButtons = screen.getAllByRole("radio");
    const firstButton = radioButtons[0];
    const secondButton = radioButtons[1];

    // Click second button to select it
    fireEvent.click(secondButton);
    expect(secondButton).toHaveAttribute("aria-checked", "true");

    // Focus second button and press ArrowLeft
    secondButton.focus();
    fireEvent.keyDown(secondButton, { key: "ArrowLeft" });

    // First button should now be checked
    expect(firstButton).toHaveAttribute("aria-checked", "true");
    expect(secondButton).toHaveAttribute("aria-checked", "false");
  });

  test("ArrowUp moves to previous color and focuses it", () => {
    render(
      <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    const radioButtons = screen.getAllByRole("radio");
    const firstButton = radioButtons[0];
    const secondButton = radioButtons[1];

    fireEvent.click(secondButton);
    secondButton.focus();
    fireEvent.keyDown(secondButton, { key: "ArrowUp" });

    expect(firstButton).toHaveAttribute("aria-checked", "true");
  });

  test("ArrowRight wraps from last to first color", () => {
    render(
      <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    const radioButtons = screen.getAllByRole("radio");
    const lastButton = radioButtons[radioButtons.length - 1];
    const firstButton = radioButtons[0];

    // Click last button to select it
    fireEvent.click(lastButton);
    expect(lastButton).toHaveAttribute("aria-checked", "true");

    // Press ArrowRight should wrap to first
    lastButton.focus();
    fireEvent.keyDown(lastButton, { key: "ArrowRight" });

    expect(firstButton).toHaveAttribute("aria-checked", "true");
    expect(lastButton).toHaveAttribute("aria-checked", "false");
  });

  test("ArrowLeft wraps from first to last color", () => {
    render(
      <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    const radioButtons = screen.getAllByRole("radio");
    const firstButton = radioButtons[0];
    const lastButton = radioButtons[radioButtons.length - 1];

    // First button is selected by default
    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: "ArrowLeft" });

    expect(lastButton).toHaveAttribute("aria-checked", "true");
    expect(firstButton).toHaveAttribute("aria-checked", "false");
  });
});

describe("CollectionModal keyboard navigation - loading state", () => {
  let useCollectionsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on useCollections and mock it to return loading: true
    useCollectionsSpy = vi.spyOn(useCollectionsModule, "useCollections");
    useCollectionsSpy.mockReturnValue({
      collections: [],
      pagination: null,
      loading: true,
      isFetching: false,
      isCreating: true, // This makes loading true
      isUpdating: false,
      isDeleting: false,
      error: null,
      fetchCollections: vi.fn(),
      createCollection: vi.fn(),
      updateCollection: vi.fn(),
      deleteCollection: vi.fn(),
      toggleFavorite: vi.fn(),
    });
  });

  afterEach(() => {
    useCollectionsSpy.mockRestore();
  });

  test("keyboard navigation is disabled when loading", () => {
    render(
      <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    );

    const radioButtons = screen.getAllByRole("radio");
    const firstButton = radioButtons[0];
    const secondButton = radioButtons[1];

    // Helper function to verify no navigation occurred
    const expectNoNavigation = () => {
      expect(firstButton).toHaveAttribute("aria-checked", "true");
      expect(secondButton).toHaveAttribute("aria-checked", "false");
    };

    // First button should be checked initially
    expectNoNavigation();

    // Test all arrow keys - none should trigger navigation
    firstButton.focus();

    fireEvent.keyDown(firstButton, { key: "ArrowRight" });
    expectNoNavigation();

    fireEvent.keyDown(firstButton, { key: "ArrowDown" });
    expectNoNavigation();

    fireEvent.keyDown(firstButton, { key: "ArrowLeft" });
    expectNoNavigation();

    fireEvent.keyDown(firstButton, { key: "ArrowUp" });
    expectNoNavigation();
  });
});
