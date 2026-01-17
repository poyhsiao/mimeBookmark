import { render, screen, fireEvent, act } from "@testing-library/react";
import { CollectionsSection } from "../collections-section";
import { expect, test, vi, describe, beforeEach, afterEach } from "vitest";
import * as useCollectionsModule from "@/hooks/use-collections";

// Mock the components that might cause issues in testing environment
vi.mock("@/components/collections/collection-card", () => ({
  CollectionCard: ({ collection }: any) => (
    <div data-testid='collection-card'>{collection.name}</div>
  ),
}));

vi.mock("@/components/collections/collection-tree", () => ({
  CollectionTree: () => <div data-testid='collection-tree'>Tree View</div>,
}));

// Mock CollectionModal to easily trigger onSuccess
vi.mock("@/components/collections/collection-modal", () => ({
  CollectionModal: ({ onSuccess, isOpen }: any) =>
    isOpen ? (
      <div data-testid='collection-modal'>
        <button data-testid='trigger-success' onClick={onSuccess}>
          Success
        </button>
      </div>
    ) : null,
}));

describe("CollectionsSection", () => {
  let useCollectionsSpy: any;
  const mockFetchCollections = vi.fn();
  const mockFetchTree = vi.fn();

  beforeEach(() => {
    useCollectionsSpy = vi.spyOn(useCollectionsModule, "useCollections");
    useCollectionsSpy.mockReturnValue({
      collections: [],
      tree: [],
      loading: false,
      error: null,
      fetchCollections: mockFetchCollections,
      fetchTree: mockFetchTree,
      deleteCollection: vi.fn(),
      toggleFavorite: vi.fn(),
      moveCollection: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("onSuccess should call fetchTree with search parameters", async () => {
    render(<CollectionsSection />);

    // Trigger New Collection modal
    const newBtn = screen.getByText("New Collection");
    fireEvent.click(newBtn);

    // Find the success trigger in the mocked modal
    const successBtn = screen.getByTestId("trigger-success");

    // We need to simulate a search first to have a debouncedSearch value
    const searchInput = screen.getByLabelText("Search collections");
    fireEvent.change(searchInput, { target: { value: "test-query" } });

    // Wait for debounce timer (300ms)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Clear mocks before triggering success to check calls specifically from onSuccess
    mockFetchCollections.mockClear();
    mockFetchTree.mockClear();

    // Trigger onSuccess
    fireEvent.click(successBtn);

    // Check if fetchCollections was called with search
    expect(mockFetchCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "test-query",
      }),
    );

    // This is the expected failure: it should be called with { search: "test-query" }
    // currently it is called with no arguments
    expect(mockFetchTree).toHaveBeenCalledWith({ search: "test-query" });
  });
});
