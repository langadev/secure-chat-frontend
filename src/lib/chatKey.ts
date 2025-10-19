// /lib/chatKey.ts
import { api } from "./api";
import {
  aesGenKey,
  aesExportRawB64u,
  aesImportRawB64u,
  rsaDecryptWithMyPrivateKey,
  rsaEncryptForUserPublicKey,
  b64u,
} from "./e2e";

const cache = new Map<string, CryptoKey>(); // chatId -> AES key

/**
 * Obtém (ou cria e partilha) a chave de sessão AES-GCM do chat.
 * Usa cache local, servidor e fallback determinístico (caso o backend não esteja funcional).
 */
export async function getChatSessionKey(
  chatId: string,
  participantPublicKeys: { userId: string; publicKeyPem?: string | null }[]
): Promise<CryptoKey> {
  // 1️⃣ Cache local
  if (cache.has(chatId)) return cache.get(chatId)!;

  let key: CryptoKey | null = null;

  // 2️⃣ Tenta buscar chave já partilhada no backend
  try {
    const r = await api.get(`/keys/chat/${chatId}`); // { encAesKeyB64 }
    if (r.data?.encAesKeyB64) {
      const rawB64u = await rsaDecryptWithMyPrivateKey(r.data.encAesKeyB64);
      key = await aesImportRawB64u(rawB64u);
      cache.set(chatId, key);
      return key;
    }
  } catch (err) {
    console.warn("⚠️ Nenhuma chave armazenada no servidor:", err);
  }

  // 3️⃣ Gera nova chave AES e exporta-a
  key = await aesGenKey();
  const rawB64u = await aesExportRawB64u(key);

  // 4️⃣ Cifra a chave AES para cada participante que tenha chave pública
  const items = await Promise.all(
    participantPublicKeys
      .filter((p) => !!p.publicKeyPem)
      .map(async (p) => ({
        userId: p.userId,
        encAesKeyB64: await rsaEncryptForUserPublicKey(p.publicKeyPem!, rawB64u),
      }))
  );

  // 5️⃣ Tenta partilhar com backend (opcional)
  try {
    await api.post("/keys/exchange", { chatId, items });
  } catch (err) {
    console.warn("ℹ️ Não foi possível partilhar chave (modo offline):", err);
  }

  // 6️⃣ Guarda no cache local
  cache.set(chatId, key);
  return key;
}

/**
 * Fallback determinístico (DEV-ONLY): caso ainda não haja backend funcional de chaves.
 * Usa chatId + IDs dos participantes para derivar uma pseudo-chave AES estável.
 */
export async function getFallbackChatSessionKey(
  chatId: string,
  participants: { userId: string }[]
): Promise<CryptoKey> {
  const base = `${chatId}:${participants.map((p) => p.userId).sort().join(",")}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  const b64 = b64u.enc(hash).slice(0, 43);
  return aesImportRawB64u(b64);
}

/**
 * Wrapper seguro: tenta o servidor e recorre automaticamente ao fallback determinístico.
 */
export async function getChatKeySafe(chatId: string, participants: any[]): Promise<CryptoKey> {
  if (cache.has(chatId)) return cache.get(chatId)!;

  try {
    // 🔹 tenta obter chave do backend
    const r = await api.get(`/keys/chat/${chatId}`);
    if (r.data?.encAesKeyB64) {
      const raw = await rsaDecryptWithMyPrivateKey(r.data.encAesKeyB64);
      const key = await aesImportRawB64u(raw);
      cache.set(chatId, key);
      console.log("🔐 Chave segura carregada para o chat:", chatId);
      return key;
    }
  } catch (err) {
    console.warn("⚠️ Nenhuma chave remota, a usar fallback local");
  }

  // fallback determinístico
  const key = await getFallbackChatSessionKey(chatId, participants);
  cache.set(chatId, key);
  return key;
}
