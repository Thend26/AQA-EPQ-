import type { SupabaseClient } from "@supabase/supabase-js";

import {
  defaultUserSettings,
  type UserSettings,
  type UserSettingsPatch,
} from "@/lib/settings/schema";

type SettingsRow = {
  theme_preset: UserSettings["themePreset"];
  custom_primary: string | null;
  custom_accent: string | null;
  font_scale: UserSettings["fontScale"];
  font_weight: UserSettings["fontWeight"];
  deepseek_model: UserSettings["deepseekModel"];
};

type RepositoryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

function fromRow(row: SettingsRow | null): UserSettings {
  if (!row) return defaultUserSettings;
  return {
    themePreset: row.theme_preset,
    customPrimary: row.custom_primary ?? undefined,
    customAccent: row.custom_accent ?? undefined,
    fontScale: row.font_scale,
    fontWeight: row.font_weight,
    deepseekModel: row.deepseek_model,
  };
}

function toUpdate(settings: UserSettingsPatch) {
  const update: Record<string, string | null> = {};
  if (settings.themePreset !== undefined) update.theme_preset = settings.themePreset;
  if (settings.customPrimary !== undefined) update.custom_primary = settings.customPrimary;
  if (settings.customAccent !== undefined) update.custom_accent = settings.customAccent;
  if (settings.fontScale !== undefined) update.font_scale = settings.fontScale;
  if (settings.fontWeight !== undefined) update.font_weight = settings.fontWeight;
  if (settings.deepseekModel !== undefined) update.deepseek_model = settings.deepseekModel;
  return update;
}

export async function getUserSettings(
  db: SupabaseClient,
  ownerId: string,
): Promise<RepositoryResult<UserSettings>> {
  const result = await db
    .from("user_settings")
    .select("theme_preset, custom_primary, custom_accent, font_scale, font_weight, deepseek_model")
    .eq("owner_id", ownerId)
    .maybeSingle();

  return {
    data: fromRow(result.data as SettingsRow | null),
    error: result.error,
  };
}

export async function updateUserSettings(
  db: SupabaseClient,
  ownerId: string,
  settings: UserSettingsPatch,
): Promise<RepositoryResult<UserSettings>> {
  const payload = {
    owner_id: ownerId,
    ...toUpdate(settings),
    updated_at: new Date().toISOString(),
  };
  const result = await db
    .from("user_settings")
    .upsert(payload, { onConflict: "owner_id" })
    .select("theme_preset, custom_primary, custom_accent, font_scale, font_weight, deepseek_model")
    .single();

  return {
    data: result.data ? fromRow(result.data as SettingsRow) : null,
    error: result.error,
  };
}
