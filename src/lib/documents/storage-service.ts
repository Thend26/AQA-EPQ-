import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const bucket = "student-documents";

export async function createSignedDownloadUrl(path: string) {
  const result = await createAdminClient()
    .storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10);
  if (result.error || !result.data?.signedUrl) {
    throw new Error("Unable to create signed document URL");
  }
  return result.data.signedUrl;
}
