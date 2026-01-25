import { render, screen } from "@testing-library/react";
import { CollectionCard } from "../collection-card";
import { expect, test, vi } from "vitest";

const mockCollection = {
  id: "1",
  name: "My Collection",
  description: "Test description",
  color: "#FF0000",
  icon: "folder",
  parent_id: null,
  is_public: false,
  is_favorite: false,
  sort_order: 0,
  bookmarks_count: 5,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: "u1",
  deleted_at: null,
};

test("CollectionCard does not use direct inline styles for dynamic colors", () => {
  const { container } = render(
    <CollectionCard
      collection={mockCollection}
      onDelete={async () => true}
      onToggleFavorite={async () => true}
    />
  );

  // The icon container (first div with style)
  // We can find it by looking for the icon or structure
  // The structure is div > div(icon container) > FolderOpen

  // Find the div that has the style background color
  // We expect it to NOT have "background-color: ..." directly in style attribute
  // But instead use a variable or class

  // Since we haven't refactored yet, this test should FAIL if we assert strict "no background-color" logic.
  // But to be precise, we want to find the element that currently has style={{ backgroundColor: ... }}

  // Using a query that targets the element structure or a known class if accessible
  // Based on code: <div className="flex-shrink-0 ... " style={{ backgroundColor: ... }}>
  const iconContainer = container.querySelector(".flex-shrink-0.w-10.h-10");
  expect(iconContainer).toBeInTheDocument();

  const style = iconContainer?.getAttribute("style") || "";

  // This expectation defines our goal: Use CSS variables instead of direct properties
  expect(style).toContain("--collection-bg");
  expect(style).not.toMatch(/(?<!-)background-color\s*:/);

  // Also check the inner icon color
  const icon = iconContainer?.querySelector("svg");
  const iconStyle = icon?.getAttribute("style") || "";
  expect(iconStyle).not.toMatch(/(?<!-)color\s*:/);
});
