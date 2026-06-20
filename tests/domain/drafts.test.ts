import { expect, test } from "vitest";

import { draftKey } from "@/lib/domain/drafts";

test("scopes browser drafts by owner student and date", () => {
  expect(draftKey("owner", "student", "2026-07-18")).toBe(
    "epq-draft:owner:student:2026-07-18",
  );
});
