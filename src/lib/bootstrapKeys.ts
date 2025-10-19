// /lib/bootstrapKeys.ts
import { api } from "./api";
import { ensureUserRsaKeys, getMyPublicPEM } from "./e2e";

export async function ensurePublicKeySynced() {
  await ensureUserRsaKeys();
  const pub = getMyPublicPEM()!;
  await api.post("/keys/public", { publicKeyPem: pub }); // grava/atualiza no servidor
}
