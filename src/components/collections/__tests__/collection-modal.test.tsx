import { render, screen } from "@testing-library/react";
import { CollectionModal } from "../collection-modal";
import { expect, test, vi } from "vitest";

test("CollectionModal has valid aria-pressed values and no inline styles", () => {
  const { container } = render(
    <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />
  );

  const buttons = screen.getAllByRole("button");
  const colorButtons = buttons.filter((b) =>
    b.className.includes("rounded-full")
  );

  expect(colorButtons.length).toBeGreaterThan(0);

  colorButtons.forEach((button) => {
    // Check aria-pressed is either "true" or "false"
    const pressed = button.getAttribute("aria-pressed");
    expect(["true", "false"]).toContain(pressed);

    // Check no inline style
    expect(button).not.toHaveAttribute("style");

    // Check it has the color class
    expect(button.className).toMatch(/color-btn-\d/);
  });
});
