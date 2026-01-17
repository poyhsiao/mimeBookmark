import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CollectionTree } from "../collection-tree";
import { expect, test, vi, beforeEach } from "vitest";

const mockTree = [
  {
    id: "1",
    name: "Root Collection",
    color: "#FF0000",
    is_favorite: false,
    bookmarks_count: 5,
    children: [
      {
        id: "2",
        name: "Child Collection",
        color: "#00FF00",
        is_favorite: true,
        bookmarks_count: 2,
        children: [],
      },
    ],
  },
];

describe("CollectionTree", () => {
  let onDelete: any;
  let onToggleFavorite: any;
  let onEdit: any;
  let onMove: any;

  beforeEach(() => {
    onDelete = vi.fn().mockResolvedValue(true);
    onToggleFavorite = vi.fn();
    onEdit = vi.fn();
    onMove = vi.fn();

    // Mock window.confirm
    vi.stubGlobal("confirm", vi.fn());
  });

  test("handleDelete prompts for confirmation and proceeds if user confirms", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);

    render(
      <CollectionTree
        tree={mockTree}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
        onMove={onMove}
      />,
    );

    // Open menu
    const menuButtons = screen.getAllByRole("button");
    // Find the more horizontal button - it's usually after the expand button and star button
    // Let's use the icon class or name if possible, or just click all menu buttons
    const moreMenuButton = screen
      .getAllByRole("button")
      .find((btn) =>
        btn.querySelector("svg")?.classList.contains("lucide-more-horizontal"),
      );

    if (moreMenuButton) {
      fireEvent.click(moreMenuButton);
    } else {
      // Fallback: the 3rd button in the first item (Expand, Star, More)
      fireEvent.click(screen.getAllByRole("button")[2]);
    }

    // Click delete
    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this collection? Bookmarks will not be deleted.",
    );

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("1");
    });
  });

  test("handleDelete does not proceed if user cancels confirmation", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);

    render(
      <CollectionTree
        tree={mockTree}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
        onMove={onMove}
      />,
    );

    // Open menu
    const moreMenuButton = screen
      .getAllByRole("button")
      .find((btn) =>
        btn.querySelector("svg")?.classList.contains("lucide-more-horizontal"),
      );

    if (moreMenuButton) {
      fireEvent.click(moreMenuButton);
    } else {
      fireEvent.click(screen.getAllByRole("button")[2]);
    }

    // Click delete
    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    // Menu should still be open or state should not have changed much besides not deleting
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });
});
