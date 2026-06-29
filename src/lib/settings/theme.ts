import type { UserSettings } from "@/lib/settings/schema";

const HEX = /^#[0-9a-fA-F]{6}$/;

const presets = {
  professional: {
    primary: "#123c69",
    primarySoft: "#dbeafe",
    accent: "#f97316",
    surface: "#f8fafc",
    text: "#0f172a",
  },
  ocean: {
    primary: "#075985",
    primarySoft: "#e0f2fe",
    accent: "#fb923c",
    surface: "#f8fafc",
    text: "#082f49",
  },
  sunrise: {
    primary: "#7c2d12",
    primarySoft: "#ffedd5",
    accent: "#2563eb",
    surface: "#fff7ed",
    text: "#1f2937",
  },
  forest: {
    primary: "#14532d",
    primarySoft: "#dcfce7",
    accent: "#f97316",
    surface: "#f7fee7",
    text: "#052e16",
  },
} as const;

const fontScales = {
  small: "0.95",
  medium: "1",
  large: "1.08",
} as const;

const fontWeights = {
  regular: "400",
  medium: "500",
  bold: "700",
} as const;

function assertHex(value: string) {
  if (!HEX.test(value)) {
    throw new Error("Invalid custom color");
  }
  return value.toLowerCase();
}

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const value = assertHex(hex).slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function contrastRatio(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
}

export function validateThemeContrast(colors: {
  primary: string;
  accent: string;
  background: string;
}) {
  const primaryOnBackground = contrastRatio(colors.primary, colors.background);
  const whiteOnAccent = contrastRatio("#ffffff", colors.accent);
  return {
    ok: primaryOnBackground >= 4.5 && whiteOnAccent >= 2,
    primaryOnBackground,
    whiteOnAccent,
  };
}

export function themeVariables(settings: UserSettings) {
  const preset =
    settings.themePreset === "custom"
      ? {
          ...presets.professional,
          primary: assertHex(settings.customPrimary ?? presets.professional.primary),
          accent: assertHex(settings.customAccent ?? presets.professional.accent),
        }
      : presets[settings.themePreset];

  return {
    "--theme-primary": preset.primary,
    "--theme-primary-soft": preset.primarySoft,
    "--theme-accent": preset.accent,
    "--theme-surface": preset.surface,
    "--theme-text": preset.text,
    "--font-scale": fontScales[settings.fontScale],
    "--font-weight": fontWeights[settings.fontWeight],
  };
}
