import { z } from "zod";

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "请输入 #RRGGBB 格式颜色");

export const themePresetSchema = z.enum([
  "professional",
  "ocean",
  "sunrise",
  "forest",
  "custom",
]);
export const fontScaleSchema = z.enum(["small", "medium", "large"]);
export const fontWeightSchema = z.enum(["regular", "medium", "bold"]);
export const deepseekModelSchema = z.enum(["chat", "reason", "v4-pro"]);

export const userSettingsSchema = z.object({
  themePreset: themePresetSchema.default("professional"),
  customPrimary: hexColorSchema.optional(),
  customAccent: hexColorSchema.optional(),
  fontScale: fontScaleSchema.default("medium"),
  fontWeight: fontWeightSchema.default("medium"),
  deepseekModel: deepseekModelSchema.default("chat"),
});

export const userSettingsPatchSchema = userSettingsSchema
  .partial()
  .passthrough()
  .transform((settings) => {
    const {
      themePreset,
      customPrimary,
      customAccent,
      fontScale,
      fontWeight,
      deepseekModel,
    } = settings;
    const allowed = {
      ...(themePreset !== undefined ? { themePreset } : {}),
      ...(customPrimary !== undefined ? { customPrimary } : {}),
      ...(customAccent !== undefined ? { customAccent } : {}),
      ...(fontScale !== undefined ? { fontScale } : {}),
      ...(fontWeight !== undefined ? { fontWeight } : {}),
      ...(deepseekModel !== undefined ? { deepseekModel } : {}),
    };
    return allowed;
  });

export type UserSettings = z.output<typeof userSettingsSchema>;
export type UserSettingsPatch = z.output<typeof userSettingsPatchSchema>;

export const defaultUserSettings: UserSettings = {
  themePreset: "professional",
  fontScale: "medium",
  fontWeight: "medium",
  deepseekModel: "chat",
};
