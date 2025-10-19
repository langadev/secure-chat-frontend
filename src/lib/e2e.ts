// /lib/e2e.ts
// WebCrypto helpers: RSA-OAEP (enc/dec), RSA-PSS (assinatura opcional) e AES-GCM.
// PRIVATE KEY fica só no browser (CryptoKey em memória). Publicamos a PUBLIC PEM no servidor.

import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

const subtle = globalThis.crypto.subtle;

// --- Base64url helpers (browser-safe, sem Buffer) ---
function abToB64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToAb(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
export const b64u = {
  enc: (ab: ArrayBuffer) =>
    abToB64(ab).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""),
  dec: (s: string) => {
    const std = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    return b64ToAb(std);
  },
};

// --- Exporta SPKI para PEM ---
async function exportSpkiPem(pubKey: CryptoKey): Promise<string> {
  const spki = await subtle.exportKey("spki", pubKey);
  const b64 = abToB64(spki);
  const chunks = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PUBLIC KEY-----\n${chunks}\n-----END PUBLIC KEY-----`;
}

/**
 * Importa uma pública RSA em PEM:
 * - Se for SPKI (BEGIN PUBLIC KEY), importa diretamente.
 * - Se for PKCS#1 (BEGIN RSA PUBLIC KEY), converte para SPKI via pkijs e importa.
 */
async function importRsaPem(publicPem: string): Promise<CryptoKey> {
  const clean = publicPem.trim();

  // 1) Tenta SPKI direto
  if (clean.includes("BEGIN PUBLIC KEY")) {
    const b64 = clean.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/\s+/g, "");
    const spkiDer = b64ToAb(b64);
    try {
      return await subtle.importKey(
        "spki",
        spkiDer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
      );
    } catch (e) {
      console.error("Falha a importar SPKI:", e);
      throw new Error("Chave pública (SPKI) inválida.");
    }
  }

// 2) Converte PKCS#1 → SPKI com pkijs/asn1js
if (clean.includes("BEGIN RSA PUBLIC KEY")) {
  try {
    const b64 = clean
      .replace(/-----(BEGIN|END) RSA PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "");
    const pkcs1Der = b64ToAb(b64);

    // === 1. Parse PKCS#1 RSAPublicKey (modulus, exponent) ===
    const asn1 = asn1js.fromBER(pkcs1Der);
    if (asn1.offset === -1) throw new Error("ASN.1 inválido (PKCS#1).");

    const seq = asn1.result.valueBlock.value;
    const modulus = seq[0].valueBlock.valueHex;
    const exponent = seq[1].valueBlock.valueHex;

    // === 2. Monta RSAPublicKey válido manualmente ===
    const rsaSeq = new asn1js.Sequence({
      value: [
        new asn1js.Integer({ valueHex: modulus }),
        new asn1js.Integer({ valueHex: exponent }),
      ],
    });
    const rsaDer = rsaSeq.toBER(false);

    // === 3. Cria SubjectPublicKeyInfo (SPKI) ===
    const spki = new pkijs.PublicKeyInfo({
      algorithm: new pkijs.AlgorithmIdentifier({
        algorithmId: "1.2.840.113549.1.1.1",
        algorithmParams: new asn1js.Null(),
      }),
      subjectPublicKey: new asn1js.BitString({ valueHex: rsaDer }),
    });

    // ✅ Versão compatível com pkijs >=3
    const spkiDer = spki.toSchema().toBER(false);

    // === 4. Importa a SPKI convertida ===
    return await subtle.importKey(
      "spki",
      spkiDer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
  } catch (e) {
    console.error("Falha a converter/importar PKCS#1 → SPKI:", e);
    throw new Error("Chave pública (PKCS#1) inválida.");
  }
}


  throw new Error("Formato de chave pública desconhecido.");
}

// --- Chaves RSA do utilizador (gera e cacheia em memória) ---
let cachedKeys: { publicKey: CryptoKey; privateKey: CryptoKey; publicPEM: string } | null = null;

export async function ensureUserRsaKeys(): Promise<{ publicPEM: string }> {
  if (cachedKeys) return { publicPEM: cachedKeys.publicPEM };

  const { publicKey, privateKey } = await subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicPEM = await exportSpkiPem(publicKey);
  cachedKeys = { publicKey, privateKey, publicPEM };
  return { publicPEM };
}

// --- Assinatura RSA-PSS (opcional) ---
export async function signRSAPSS(privateKey: CryptoKey, dataUtf8: string): Promise<string> {
  const sig = await subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    privateKey,
    new TextEncoder().encode(dataUtf8)
  );
  return b64u.enc(sig);
}
export async function verifyRSAPSS(publicKey: CryptoKey, dataUtf8: string, sigB64u: string) {
  return subtle.verify(
    { name: "RSA-PSS", saltLength: 32 },
    publicKey,
    b64u.dec(sigB64u),
    new TextEncoder().encode(dataUtf8)
  );
}

// --- AES-GCM helpers ---
export async function aesGenKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
export async function aesExportRawB64u(key: CryptoKey): Promise<string> {
  const raw = await subtle.exportKey("raw", key);
  return b64u.enc(raw);
}
export async function aesImportRawB64u(b64: string): Promise<CryptoKey> {
  return subtle.importKey("raw", b64u.dec(b64), "AES-GCM", true, ["encrypt", "decrypt"]);
}
export async function aesEncryptCompact(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${b64u.enc(iv.buffer)}.${b64u.enc(ct)}`;
}
export async function aesDecryptCompact(compact: string, key: CryptoKey) {
  try {
    if (!compact || typeof compact !== "string" || !compact.includes(".")) {
      throw new Error("Formato inválido da mensagem cifrada");
    }

    const [ivB64, ctB64] = compact.split(".");
    const iv = new Uint8Array(b64u.dec(ivB64));
    const ct = b64u.dec(ctB64);

    const pt = await subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch (err: any) {
    console.warn("⚠️ Falha ao decifrar AES-GCM — mensagem ilegível:", {
      erro: err?.message || "OperationError (provável chave diferente)",
      compact: compact.slice(0, 30) + "...",
    });
    return "🔒 Mensagem cifrada (não foi possível decifrar)";
  }
}



// --- RSA-OAEP para cifrar/decifrar a chave AES do chat ---
export async function rsaEncryptForUserPublicKey(publicPem: string, rawKeyB64u: string) {
  const pub = await importRsaPem(publicPem); // aceita SPKI e PKCS#1
  const enc = await subtle.encrypt({ name: "RSA-OAEP" }, pub, b64u.dec(rawKeyB64u));
  return b64u.enc(enc);
}
export async function rsaDecryptWithMyPrivateKey(encB64u: string): Promise<string> {
  if (!cachedKeys) await ensureUserRsaKeys();
  const raw = await subtle.decrypt({ name: "RSA-OAEP" }, cachedKeys!.privateKey, b64u.dec(encB64u));
  return b64u.enc(raw);
}

// --- Expor minhas chaves (para assinatura opcional) ---
export function getMyPrivateKey(): CryptoKey | null {
  return cachedKeys?.privateKey ?? null;
}
export function getMyPublicPEM(): string | null {
  return cachedKeys?.publicPEM ?? null;
}
