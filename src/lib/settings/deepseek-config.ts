import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecret,
} from "@/lib/settings/encryption";
import { defaultUserSettings, type UserSettings } from "@/lib/settings/schema";

export type DeepSeekKeyStatus = {
  configured: boolean;
  last4?: string;
  updatedAt?: string;
};

export type DeepSeekRuntimeConfig = {
  apiKey: string;
  model: string;
};

type DeepSeekSettingsRow = {
  deepseek_model: UserSettings["deepseekModel"] | null;
  deepseek_key_ciphertext: string | null;
  deepseek_key_iv: string | null;
  deepseek_key_tag: string | null;
  deepseek_key_last4: string | null;
  deepseek_key_updated_at: string | null;
};

const modelIds: Record<UserSettings["deepseekModel"], string> = {
  chat: "deepseek-chat",
  reason: "deepseek-reasoner",
  "v4-pro": "deepseek-v4-pro",
};

function encryptionKey() {
  const key = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!key) throw new Error("SETTINGS_ENCRYPTION_KEY is not configured");
  return key;
}

function providerModel(model: UserSettings["deepseekModel"] | null | undefined) {
  return modelIds[model ?? defaultUserSettings.deepseekModel];
}

function statusFromRow(row: DeepSeekSettingsRow | null): DeepSeekKeyStatus {
  return {
    configured: Boolean(row?.deepseek_key_ciphertext),
    ...(row?.deepseek_key_last4 ? { last4: row.deepseek_key_last4 } : {}),
    ...(row?.deepseek_key_updated_at
      ? { updatedAt: row.deepseek_key_updated_at }
      : {}),
  };
}

export async function getDeepSeekKeyStatus(
  db: SupabaseClient,
  ownerId: string,
): Promise<DeepSeekKeyStatus> {
  const result = await db
    .from("user_settings")
    .select("deepseek_key_ciphertext, deepseek_key_last4, deepseek_key_updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  return statusFromRow(result.data as DeepSeekSettingsRow | null);
}

export async function saveDeepSeekKey(
  db: SupabaseClient,
  ownerId: string,
  apiKey: string,
): Promise<DeepSeekKeyStatus> {
  const trimmed = apiKey.trim();
  const encrypted = encryptSecret(trimmed, encryptionKey());
  const last4 = trimmed.slice(-4);
  const updatedAt = new Date().toISOString();
  const result = await db
    .from("user_settings")
    .upsert(
      {
        owner_id: ownerId,
        deepseek_key_ciphertext: encrypted.ciphertext,
        deepseek_key_iv: encrypted.iv,
        deepseek_key_tag: encrypted.tag,
        deepseek_key_last4: last4,
        deepseek_key_updated_at: updatedAt,
        updated_at: updatedAt,
      },
      { onConflict: "owner_id" },
    )
    .select("deepseek_key_ciphertext, deepseek_key_last4, deepseek_key_updated_at")
    .single();

  if (result.error) throw new Error("Unable to save DeepSeek key");
  return statusFromRow(result.data as DeepSeekSettingsRow);
}

export async function deleteDeepSeekKey(
  db: SupabaseClient,
  ownerId: string,
): Promise<DeepSeekKeyStatus> {
  const result = await db
    .from("user_settings")
    .update({
      deepseek_key_ciphertext: null,
      deepseek_key_iv: null,
      deepseek_key_tag: null,
      deepseek_key_last4: null,
      deepseek_key_updated_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId);

  if (result.error) throw new Error("Unable to delete DeepSeek key");
  return { configured: false };
}

export async function getDeepSeekRuntimeConfig(
  db: SupabaseClient,
  ownerId: string,
): Promise<DeepSeekRuntimeConfig | null> {
  const result = await db
    .from("user_settings")
    .select("deepseek_model, deepseek_key_ciphertext, deepseek_key_iv, deepseek_key_tag, deepseek_key_last4, deepseek_key_updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const row = result.data as DeepSeekSettingsRow | null;
  if (
    result.error ||
    !row?.deepseek_key_ciphertext ||
    !row.deepseek_key_iv ||
    !row.deepseek_key_tag
  ) {
    return null;
  }

  const encrypted: EncryptedSecret = {
    ciphertext: row.deepseek_key_ciphertext,
    iv: row.deepseek_key_iv,
    tag: row.deepseek_key_tag,
  };
  return {
    apiKey: decryptSecret(encrypted, encryptionKey()),
    model: providerModel(row.deepseek_model),
  };
}
