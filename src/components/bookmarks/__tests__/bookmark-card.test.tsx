import { render, screen, fireEvent } from "@testing-library/react";
import { BookmarkCard } from "../bookmark-card";
import { expect, test, vi } from "vitest";

const mockBookmark = {
  id: "1",
  url: "https://example.com",
  title: "Example",
  description: "Example description",
  domain: "example.com",
  favicon_url: null,
  og_image: null,
  is_archived: false,
  is_favorite: false,
  is_read_later: false,
  source: 'web' as const,
  clicks: 0,
  last_opened_at: null,
  metadata: {},
  user_notes: null,
  user_rating: null,
  tags: [{ id: "t1", name: "Tag 1", color: "#ff0000", usage_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_id: "u1", deleted_at: null }],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: "u1",
  deleted_at: null,
};

test("BookmarkCard has discernible text for the menu backdrop button", () => {
  render(
    <BookmarkCard
      bookmark={{ ...mockBookmark }}
      onDelete={async () => true}
      onToggleFavorite={async () => true}
    />
  );

  // Trigger showMenu by clicking the last button in the row (the "more" button)
  const buttons = screen.getAllByRole("button");
  const menuButton = buttons[buttons.length - 1];
  fireEvent.click(menuButton);

  // The backdrop button should be visible now
  const backdrop = screen.getByLabelText("Close menu");
  expect(backdrop).toHaveAttribute("title", "Close menu");
});

test("BookmarkCard does not use direct inline styles for colors", () => {
  const { container } = render(
    <BookmarkCard
      bookmark={{ ...mockBookmark }}
      onDelete={async () => true}
      onToggleFavorite={async () => true}
    />
  );

  const tag = container.querySelector(".bookmark-tag");
  const style = tag?.getAttribute("style") || "";
  // Should use variables, not direct properties
  // Check that it doesn't have "color:" or "background-color:" as direct properties
  // CSS variables start with --
  expect(style).toContain("--tag-bg");
  expect(style).toContain("--tag-color");

  // A regex check to ensure no plain "color: ..." or "background-color: ..."
  expect(style).not.toMatch(/(?<!-)color\s*:/);
  expect(style).not.toMatch(/(?<!-)background-color\s*:/);
});
