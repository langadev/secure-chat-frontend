// src/lib/clientCrypto.ts

// Converte base64url <-> base64 e utilidades
function b64urlToB64(s: string) {
  return s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}
export const b64u = {
  enc: (ab: ArrayBuffer) => bytesToB64(ab).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""),
  dec: (s: string) => b64ToBytes(b64urlToB64(s)),
};

export async function importAesKey(aesKeyB64_or_B64u: string): Promise<CryptoKey> {
  const clean = b64urlToB64(aesKeyB64_or_B64u.trim()); // aceita base64url também
  const raw = b64ToBytes(clean);
  if (![16, 32].includes(raw.byteLength)) {
    throw new Error(`AES key must be 128 or 256 bits, got ${raw.byteLength * 8} bits`);
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Formato de payload: base64url(iv).base64url(ciphertext)
// (tag vai embutida pelo WebCrypto no ciphertext; não precisa separar)
export async function encryptMessage(plaintext: string, aesKeyB64: string): Promise<string> {
  const key = await importAesKey(aesKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${b64u.enc(iv)}.${b64u.enc(ct)}`;
}

export async function decryptMessage(compact: string, aesKeyB64: string): Promise<string> {
  const key = await importAesKey(aesKeyB64);
  const [ivB64u, ctB64u] = compact.split(".");
  if (!ivB64u || !ctB64u) throw new Error("Invalid compact format");
  const iv = b64u.dec(ivB64u);
  const ct = b64u.dec(ctB64u);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
