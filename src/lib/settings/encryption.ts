import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function validateEncryptionKey(base64Key: string) {
  const key = Buffer.from(base64Key, "base64");
  if (key.byteLength !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes");
  }
  return key;
}

export function encryptSecret(secret: string, base64Key: string): EncryptedSecret {
  const key = validateEncryptionKey(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(
  encrypted: EncryptedSecret,
  base64Key: string,
) {
  try {
    const key = validateEncryptionKey(base64Key);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SETTINGS_ENCRYPTION_KEY must be 32 bytes"
    ) {
      throw error;
    }
    throw new Error("Unable to decrypt secret");
  }
}
