import { render, screen } from "@testing-library/react";
import { CollectionModal } from "../collection-modal";
import { expect, test, vi } from "vitest";

test("CollectionModal has valid aria-checked values and no inline styles", () => {
  const { container } = render(
    <CollectionModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />
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
