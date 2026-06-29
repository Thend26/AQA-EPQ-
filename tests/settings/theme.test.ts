import { describe, expect, test } from "vitest";

import {
  contrastRatio,
  themeVariables,
  validateThemeContrast,
} from "@/lib/settings/theme";

describe("theme settings", () => {
  test("generates professional blue/orange CSS variables by default", () => {
    expect(
      themeVariables({
        themePreset: "professional",
        fontScale: "medium",
        fontWeight: "medium",
        deepseekModel: "chat",
      }),
    ).toMatchObject({
      "--theme-primary": "#123c69",
      "--theme-accent": "#f97316",
      "--font-scale": "1",
      "--font-weight": "500",
    });
  });

  test("supports presets, custom colors, font scale, and font weight", () => {
    const variables = themeVariables({
      themePreset: "custom",
      customPrimary: "#0f172a",
      customAccent: "#fb923c",
      fontScale: "large",
      fontWeight: "bold",
      deepseekModel: "reason",
    });

    expect(variables["--theme-primary"]).toBe("#0f172a");
    expect(variables["--theme-accent"]).toBe("#fb923c");
    expect(variables["--font-scale"]).toBe("1.08");
    expect(variables["--font-weight"]).toBe("700");
  });

  test("rejects invalid hex colors and low-contrast combinations", () => {
    expect(() =>
      themeVariables({
        themePreset: "custom",
        customPrimary: "blue",
        customAccent: "#f97316",
        fontScale: "medium",
        fontWeight: "medium",
        deepseekModel: "chat",
      }),
    ).toThrow("Invalid custom color");

    expect(
      validateThemeContrast({
        primary: "#ffffff",
        accent: "#fefefe",
        background: "#ffffff",
      }).ok,
    ).toBe(false);
  });

  test("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeGreaterThan(20);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
});
