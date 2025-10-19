// src/lib/chatStorage.ts
const PREFIX = "chat:aes:";

export function getChatKey(chatId: string): string | null {
  try { return localStorage.getItem(PREFIX + chatId); } catch { return null; }
}

export function saveChatKey(chatId: string, aesKeyB64: string) {
  try { localStorage.setItem(PREFIX + chatId, aesKeyB64); } catch {}
}
