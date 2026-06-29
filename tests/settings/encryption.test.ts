import { describe, expect, test } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  validateEncryptionKey,
} from "@/lib/settings/encryption";

const key = Buffer.alloc(32, 7).toString("base64");

describe("settings secret encryption", () => {
  test("round-trips secrets with AES-256-GCM", () => {
    const encrypted = encryptSecret("sk-test-secret", key);

    expect(decryptSecret(encrypted, key)).toBe("sk-test-secret");
    expect(encrypted.ciphertext).not.toContain("sk-test-secret");
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
  });

  test("uses a random IV for each encryption", () => {
    const first = encryptSecret("same-secret", key);
    const second = encryptSecret("same-secret", key);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  test("rejects tampered ciphertext and invalid keys", () => {
    const encrypted = encryptSecret("sk-test-secret", key);

    expect(() =>
      decryptSecret({ ...encrypted, ciphertext: encrypted.ciphertext.slice(1) }, key),
    ).toThrow("Unable to decrypt secret");
    expect(() => validateEncryptionKey(Buffer.alloc(31).toString("base64"))).toThrow(
      "SETTINGS_ENCRYPTION_KEY must be 32 bytes",
    );
  });
});
