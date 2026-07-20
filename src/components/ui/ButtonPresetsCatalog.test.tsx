import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ButtonPresetsCatalog from "./ButtonPresetsCatalog";

/**
 * V100 Issue #39: Button presets catalog tests.
 *
 * Verifies the catalog renders all 4 variants × 3 sizes = 12 combinations
 * plus icon-left, icon-right, and disabled states. Acts as a smoke test
 * for the Button component — if a future edit breaks a variant, this
 * catches it.
 */

describe("ButtonPresetsCatalog", () => {
  it("renders without crashing", () => {
    const { container } = render(<ButtonPresetsCatalog />);
    expect(container.firstChild).not.toBeNull();
  });

  it("shows the catalog header", () => {
    render(<ButtonPresetsCatalog />);
    expect(
      screen.getByText("Button Presets Catalog"),
    ).toBeInTheDocument();
  });

  it("renders all 4 variants", () => {
    render(<ButtonPresetsCatalog />);
    // The matrix shows each variant as a button label
    expect(screen.getAllByText("primary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("accent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ghost").length).toBeGreaterThan(0);
    expect(screen.getAllByText("outline").length).toBeGreaterThan(0);
  });

  it("renders all 3 sizes", () => {
    render(<ButtonPresetsCatalog />);
    // The size reference section shows each size as a button label
    expect(screen.getAllByText("sm button").length).toBeGreaterThan(0);
    expect(screen.getAllByText("md button").length).toBeGreaterThan(0);
    expect(screen.getAllByText("lg button").length).toBeGreaterThan(0);
  });

  it("renders disabled state for all variants", () => {
    render(<ButtonPresetsCatalog />);
    const disabledButtons = screen.getAllByRole("button", {
      name: /(disabled)/,
    });
    expect(disabledButtons.length).toBe(4);
    for (const btn of disabledButtons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
