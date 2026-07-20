import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  BodyIcon,
  BallIcon,
  HeadIcon,
  GlovesIcon,
  ATTRIBUTE_CATEGORY_ICONS,
} from "./GafferIcons";

/**
 * V100 Issue #38: Attribute category icons.
 *
 * Each icon (Body/Ball/Head/Gloves) must render as an SVG with the
 * expected 24x24 viewBox and accept the standard GafferIcon props
 * (size, brassColor, plus passthrough SVG props).
 *
 * The ATTRIBUTE_CATEGORY_ICONS map must expose all 4 keys so callers
 * can look up by category name without a switch statement.
 */

describe("Attribute category icons", () => {
  it("ATTRIBUTE_CATEGORY_ICONS exposes all 4 categories", () => {
    expect(Object.keys(ATTRIBUTE_CATEGORY_ICONS).sort()).toEqual(
      ["ball", "body", "gloves", "head"],
    );
  });

  it("BodyIcon renders an SVG with 24x24 viewBox", () => {
    const { container } = render(<BodyIcon size={20} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("height")).toBe("20");
  });

  it("BallIcon accepts brassColor and renders", () => {
    const { container } = render(<BallIcon size={16} brassColor="#ff0000" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("16");
  });

  it("HeadIcon renders without crashing", () => {
    const { container } = render(<HeadIcon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("GlovesIcon renders without crashing", () => {
    const { container } = render(<GlovesIcon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("All 4 icons accept className passthrough", () => {
    for (const Icon of Object.values(ATTRIBUTE_CATEGORY_ICONS)) {
      const { container } = render(<Icon className="test-class" />);
      expect(container.querySelector("svg.test-class")).not.toBeNull();
    }
  });
});
