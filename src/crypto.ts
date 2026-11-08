// API Key 的 PIN 加密存储：WebCrypto AES-GCM + PBKDF2（仅浏览器本地模式使用）
// 格式：base64(salt).base64(iv).base64(ciphertext)

const PBKDF2_ITERATIONS = 150_000;

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** 用 PIN 加密文本，返回 "salt.iv.ciphertext" 三段 base64 */
export async function encryptWithPin(pin: string, plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${b64encode(salt)}.${b64encode(iv)}.${b64encode(ct)}`;
}

/** 用 PIN 解密；PIN 错误时抛出异常 */
export async function decryptWithPin(pin: string, blob: string): Promise<string> {
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("加密数据格式不正确");
  const salt = b64decode(parts[0]);
  const iv = b64decode(parts[1]);
  const ct = b64decode(parts[2]);
  const key = await deriveKey(pin, salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource
  );
  return new TextDecoder().decode(pt);
}
