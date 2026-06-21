import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const adminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
});

export function createAdminClient() {
  const parsed = adminEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    throw new Error("Supabase admin client is not configured");
  }

  return createClient(
    parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
