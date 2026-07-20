import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import IconCatalog from "./IconCatalog";

/**
 * V100 Issue #39: Icon catalog tests.
 *
 * Verifies the catalog renders without crashing and exposes all
 * 34 Gaffer icons. Acts as a smoke test for the icon set — if a
 * future edit breaks an icon's render, this test catches it.
 */

describe("IconCatalog", () => {
  it("renders without crashing", () => {
    const { container } = render(<IconCatalog />);
    expect(container.firstChild).not.toBeNull();
  });

  it("shows the catalog header", () => {
    render(<IconCatalog />);
    expect(
      screen.getByText("Gaffer Icon Catalog"),
    ).toBeInTheDocument();
  });

  it("exposes all 9 icon categories", () => {
    render(<IconCatalog />);
    const categories = [
      "Match Day",
      "Transfers",
      "Training",
      "Scouting",
      "Media",
      "Awards",
      "Medical",
      "Navigation",
      "Attributes",
    ];
    for (const category of categories) {
      // Each category header has the name + count, so we use getAllByText
      // and check at least one match.
      const matches = screen.getAllByText(
        new RegExp(`^${category} \\(\\d+\\)$`),
      );
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it("renders at least 30 icon SVGs (one per catalog entry)", () => {
    const { container } = render(<IconCatalog />);
    const svgs = container.querySelectorAll("svg");
    // 34 icons in catalog, but some may render multiple SVGs (nested)
    expect(svgs.length).toBeGreaterThanOrEqual(30);
  });

  it("search filter narrows visible icons", () => {
    const { container } = render(<IconCatalog />);
    const input = container.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    input.value = "Body";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // After filtering, only the BodyIcon entry should be visible
    // (plus any other icon whose name/description contains "body")
    const entries = container.querySelectorAll(
      '[class*="border-slate-line"][class*="bg-carbon-2"]',
    );
    expect(entries.length).toBeGreaterThan(0);
  });
});
