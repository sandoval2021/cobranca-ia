// AES-256-GCM encryption helpers para senhas de painel IPTV.
// Server-only. Chave em process.env.CREDENTIALS_ENC_KEY.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENC_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENC_KEY not configured");
  // Deriva 32 bytes via SHA-256 — aceita qualquer comprimento de secret.
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, ivB64, tagB64, encB64] = payload.split(".");
    if (version !== "v1" || !ivB64 || !tagB64 || !encB64) return null;
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function maskSecret(payload: string | null | undefined): string {
  if (!payload) return "";
  return "••••••••";
}
