// src/app/dh-users/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api"; // axios configurado do teu projeto
import {
  Users,
  Key,
  Lock,
  Unlock,
  RefreshCw,
  Play,
  Pause,
  FastForward,
  Shield,
  Copy,
  Check,
} from "lucide-react";

/* ============================
   Utils de números grandes (DH)
   ============================ */
const modExp = (base: bigint, exp: bigint, mod: bigint): bigint => {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if ((e & 1n) === 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
};

const getRandomBigInt = (bits: number): bigint => {
  const bytes = Math.ceil(bits / 8);
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  // força bit alto para evitar valores muito pequenos
  arr[0] |= 0x80;
  let v = 0n;
  for (const b of arr) v = (v << 8n) | BigInt(b);
  return v;
};

const b64u = {
  enc: (buf: Uint8Array) =>
    btoa(String.fromCharCode(...buf))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, ""),
  dec: (s: string) => {
    const pad = "===".slice((s.length + 3) % 4);
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

const hexToBigInt = (hex: string): bigint => BigInt("0x" + hex);

/** RFC 3526 MODP group (1536-bit) – suficiente p/ demo */
const P_HEX =
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
  "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
  "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
  "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
  "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381" +
  "FFFFFFFFFFFFFFFF";
const G = 2n;
const p = hexToBigInt(P_HEX);

/* =====================================
   Derivar AES-256 a partir do shared key
   ===================================== */
async function deriveAesKeyFromShared(shared: bigint): Promise<CryptoKey> {
  // Converte bigint -> bytes big-endian
  const bytes = (() => {
    if (shared === 0n) return new Uint8Array([0]);
    const tmp: number[] = [];
    let v = shared;
    while (v > 0n) {
      tmp.push(Number(v & 0xffn));
      v >>= 8n;
    }
    tmp.reverse();
    return new Uint8Array(tmp);
  })();

  // SHA-256(shared) -> importa como chave raw (32 bytes)
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", hashBuf, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function aesGcmEncrypt(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return `${b64u.enc(iv)}.${b64u.enc(new Uint8Array(ct))}`;
}

async function aesGcmDecrypt(compact: string, key: CryptoKey) {
  const [ivB64, ctB64] = compact.split(".");
  const iv = b64u.dec(ivB64);
  const ct = b64u.dec(ctB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

/* ============================
   Tipos
   ============================ */
interface User {
  id: string;
  name?: string | null;
  email: string;
  publicKeyPem?: string | null; // se existir na tua API
}

/* ============================
   Componente
   ============================ */
export default function DhUsersPage() {
  // Carregamento de utilizadores
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  // Seleção
  const [aliceId, setAliceId] = useState<string | null>(null);
  const [bobId, setBobId] = useState<string | null>(null);
  const alice = useMemo(() => users?.find((u) => u.id === aliceId) ?? null, [users, aliceId]);
  const bob = useMemo(() => users?.find((u) => u.id === bobId) ?? null, [users, bobId]);

  // Chaves (privadas/ públicas) & segredos
  const [aPriv, setAPriv] = useState<bigint>(() => getRandomBigInt(256));
  const [bPriv, setBPriv] = useState<bigint>(() => getRandomBigInt(256));
  const [aPub, setAPub] = useState<bigint>(0n);
  const [bPub, setBPub] = useState<bigint>(0n);
  const [sharedA, setSharedA] = useState<bigint>(0n);
  const [sharedB, setSharedB] = useState<bigint>(0n);

  // AES e mensagem
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);
  const [message, setMessage] = useState("Olá do DH 🔐");
  const [cipher, setCipher] = useState("");
  const [plain, setPlain] = useState("");

  // Simulação (passos)
  const steps = [
    "Selecionar Alice e Bob",
    "Alice escolhe chave privada (a)",
    "Bob escolhe chave privada (b)",
    "Alice calcula chave pública A = g^a mod p",
    "Bob calcula chave pública B = g^b mod p",
    "Troca de chaves públicas (A ⇄ B) num canal inseguro",
    "Alice calcula segredo s = B^a mod p",
    "Bob calcula segredo s = A^b mod p",
    "Derivar AES-256 de s (SHA-256)",
    "Cifrar mensagem com AES-GCM",
    "Decifrar mensagem",
  ];
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);

  // Copiar helpers
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (txt: string, key: string) => {
    await navigator.clipboard.writeText(txt);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  /* ============================
     Fetch utilizadores
     ============================ */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Se o teu axios base já aponta para /api, isto será GET /api/users
        const res = await api.get<User[]>("/users");
        if (!active) return;
        setUsers(res.data);
      } catch (err: any) {
        if (!active) return;
        setErrorUsers(err?.response?.data?.error || err?.message || "Erro ao carregar utilizadores");
      } finally {
        if (active) setLoadingUsers(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ============================
     Cálculos DH sempre que privs mudam
     ============================ */
  useEffect(() => {
    const A = modExp(G, aPriv, p);
    const B = modExp(G, bPriv, p);
    setAPub(A);
    setBPub(B);
    const sA = modExp(B, aPriv, p);
    const sB = modExp(A, bPriv, p);
    setSharedA(sA);
    setSharedB(sB);
  }, [aPriv, bPriv]);

  /* ============================
     Animação automática de passos
     ============================ */
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    if (isPlaying && currentStep < steps.length - 1) {
      t = setInterval(() => {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      }, speed);
    }
    return () => t && clearInterval(t);
  }, [isPlaying, currentStep, speed]);

  /* ============================
     Ações por passo
     ============================ */
  const doStepAction = async (step: number) => {
    if (!alice || !bob) return;

    if (step === 1) setAPriv(getRandomBigInt(256));
    if (step === 2) setBPriv(getRandomBigInt(256));
    if (step === 8 && sharedA === sharedB) {
      const key = await deriveAesKeyFromShared(sharedA);
      setAesKey(key);
    }
    if (step === 9 && aesKey) {
      const ct = await aesGcmEncrypt(message, aesKey);
      setCipher(ct);
      setPlain("");
    }
    if (step === 10 && aesKey && cipher) {
      const pt = await aesGcmDecrypt(cipher, aesKey);
      setPlain(pt);
    }
  };

  useEffect(() => {
    doStepAction(currentStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, aesKey, cipher, message, aliceId, bobId]);

  /* ============================
     Helpers UI
     ============================ */
  const reset = () => {
    setAPriv(getRandomBigInt(256));
    setBPriv(getRandomBigInt(256));
    setAesKey(null);
    setCipher("");
    setPlain("");
    setCurrentStep(0);
    setIsPlaying(false);
  };

  if (loadingUsers) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-600">
        A carregar utilizadores…
      </div>
    );
  }
  if (errorUsers) {
    return (
      <div className="min-h-screen grid place-items-center text-red-600">
        Erro: {errorUsers}
      </div>
    );
  }
  if (!users || users.length < 2) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-700">
        É necessário ter pelo menos 2 utilizadores na API para simular.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Demo: Troca de Chaves Diffie-Hellman
            </h1>
          </div>
          <p className="text-gray-600">
            Busca utilizadores da tua API e simula a criação de um segredo partilhado para cifrar mensagens com AES-GCM.
          </p>
        </div>

        {/* Seleção de participantes */}
        <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-500" />
            Seleciona os participantes
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Alice</label>
              <select
                value={aliceId || ""}
                onChange={(e) => setAliceId(e.target.value || null)}
                className="w-full text-gray-600  border rounded-lg px-3 py-2"
              >
                <option value="">Escolhe a Alice</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name || u.email) + " "}
                    {u.id === bobId ? "(já escolhido como Bob)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Bob</label>
              <select
                value={bobId || ""}
                onChange={(e) => setBobId(e.target.value || null)}
                className="w-full text-gray-600  border rounded-lg px-3 py-2"
              >
                <option value="">Escolhe o Bob</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name || u.email) + " "}
                    {u.id === aliceId ? "(já escolhido como Alice)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Dica: usa dois utilizadores distintos (não seleciones o mesmo nos dois lados).
          </p>
        </div>

        {/* Painel DH */}
        {alice && bob && (
          <>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Parâmetros públicos & controlo */}
              <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-500" />
                  Parâmetros & Controlo
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="font-medium text-blue-900">Parâmetros públicos (p, g)</div>
                    <div className="text-blue-800">
                      <span className="font-mono break-all">
                        p = {P_HEX.slice(0, 48)}… (1536-bit)
                      </span>
                      <br />
                      g = {G.toString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                      className="flex-1 py-2 px-3 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setIsPlaying((p) => !p)}
                      className={`flex-1 py-2 px-3 rounded-lg text-white ${
                        isPlaying ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-600 hover:bg-blue-700"
                      } flex items-center justify-center gap-2`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isPlaying ? "Pausar" : "Iniciar"}
                    </button>
                    <button
                      onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
                      className="flex-1 py-2 px-3 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
                    >
                      <FastForward className="w-4 h-4" />
                      Próximo
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-gray-600">Velocidade:</span>
                    <select
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="border rounded-lg px-3 py-2"
                    >
                      <option value={2000}>Lenta</option>
                      <option value={1000}>Normal</option>
                      <option value={500}>Rápida</option>
                    </select>
                    <button
                      onClick={reset}
                      className="ml-auto py-2 px-3 bg-gray-800 text-white rounded-lg hover:bg-black flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reiniciar
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progresso</span>
                      <span>
                        Passo {currentStep + 1} de {steps.length}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-700">{steps[currentStep]}</div>
                  </div>
                </div>
              </div>

              {/* Visão Alice/Bob */}
              <div className="bg-white rounded-2xl shadow p-6 border border-gray-200 space-y-6">
                {/* Alice */}
                <div
                  className={`p-4 rounded-xl border-2 transition-all ${
                    currentStep >= 1 ? "border-green-500 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-500 rounded-full grid place-items-center text-white font-bold">
                      A
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">
                        Alice — {alice.name || alice.email}
                      </div>
                      <div className="text-xs text-gray-500">id: {alice.id}</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-700 space-y-2">
                    <div>
                      <span className="font-medium">a (privado): </span>
                      <span className="font-mono break-all">
                        {currentStep >= 1 ? aPriv.toString(16) : "?"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div>
                        <span className="font-medium">A (público): </span>
                        <span className="font-mono break-all">
                          {currentStep >= 3 ? aPub.toString(16) : "?"}
                        </span>
                      </div>
                      {currentStep >= 3 && (
                        <button
                          onClick={() => copy(aPub.toString(16), "A")}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          title="copiar A"
                        >
                          {copied === "A" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          copiar
                        </button>
                      )}
                    </div>
                    {currentStep >= 6 && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center gap-2 text-blue-700">
                          <Lock className="w-4 h-4" />
                          <span className="font-medium">Segredo s (Alice):</span>
                        </div>
                        <div className="font-mono text-blue-800 break-all">{sharedA.toString(16)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Canal */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dashed border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <div
                      className={`px-4 py-1 rounded-lg border text-sm ${
                        currentStep >= 5 ? "bg-yellow-50 border-yellow-300" : "bg-gray-50 border-gray-200"
                      } text-gray-600 `}
                    >
                      {currentStep >= 5 ? "A e B trocados via canal inseguro" : "Canal inseguro"}
                    </div>
                  </div>
                </div>

                {/* Bob */}
                <div
                  className={`p-4 rounded-xl border-2 transition-all ${
                    currentStep >= 2 ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-500 rounded-full grid place-items-center text-white font-bold">
                      B
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">
                        Bob — {bob.name || bob.email}
                      </div>
                      <div className="text-xs text-gray-500">id: {bob.id}</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-700 space-y-2">
                    <div>
                      <span className="font-medium">b (privado): </span>
                      <span className="font-mono break-all">
                        {currentStep >= 2 ? bPriv.toString(16) : "?"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div>
                        <span className="font-medium">B (público): </span>
                        <span className="font-mono break-all">
                          {currentStep >= 4 ? bPub.toString(16) : "?"}
                        </span>
                      </div>
                      {currentStep >= 4 && (
                        <button
                          onClick={() => copy(bPub.toString(16), "B")}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          title="copiar B"
                        >
                          {copied === "B" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          copiar
                        </button>
                      )}
                    </div>
                    {currentStep >= 7 && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center gap-2 text-blue-700">
                          <Lock className="w-4 h-4" />
                          <span className="font-medium">Segredo s (Bob):</span>
                        </div>
                        <div className="font-mono text-blue-800 break-all">{sharedB.toString(16)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AES-GCM: cifrar / decifrar */}
              <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-600" />
                  Mensagem cifrada com AES-GCM
                </h3>

                <div className="space-y-3">
                  <div className="text-sm">
                    {sharedA === sharedB ? (
                      <div className="text-emerald-700">
                        ✅ Segredos coincidem (Alice = Bob). Podes derivar a chave AES (passo 9).
                      </div>
                    ) : (
                      <div className="text-red-600">❌ Segredos diferentes — reve o fluxo.</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (sharedA !== sharedB) return;
                        const key = await deriveAesKeyFromShared(sharedA);
                        setAesKey(key);
                        setCurrentStep((s) => Math.max(s, 8));
                      }}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Derivar AES-256
                    </button>
                    <button
                      onClick={async () => {
                        if (!aesKey) return;
                        const ct = await aesGcmEncrypt(message, aesKey);
                        setCipher(ct);
                        setPlain("");
                        setCurrentStep((s) => Math.max(s, 9));
                      }}
                      className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      disabled={!aesKey}
                    >
                      Cifrar
                    </button>
                    <button
                      onClick={async () => {
                        if (!aesKey || !cipher) return;
                        const pt = await aesGcmDecrypt(cipher, aesKey);
                        setPlain(pt);
                        setCurrentStep((s) => Math.max(s, 10));
                      }}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                      disabled={!aesKey || !cipher}
                    >
                      Decifrar
                    </button>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Mensagem</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 mt-1"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <div className="text-sm">
                    <div className="text-gray-600 mb-1">Payload (iv.ciphertext b64url)</div>
                    <div className="font-mono bg-gray-50 border rounded-lg p-2 break-all">
                      {cipher || "—"}
                    </div>
                  </div>

                  <div className="text-sm">
                    <div className="text-gray-600 mb-1">Decifrado</div>
                    <div className="font-mono bg-gray-50 border rounded-lg p-2 break-all">
                      {plain || "—"}
                    </div>
                  </div>

                  {aesKey && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Unlock className="w-4 h-4" />
                      Chave AES-256 ativa (derivada de s via SHA-256)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resultado final */}
            {currentStep >= 10 && sharedA === sharedB && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow">
                <div className="flex items-center gap-3">
                  <Unlock className="w-6 h-6" />
                  <div>
                    <div className="font-semibold">Chave secreta estabelecida e utilizada!</div>
                    <div className="text-emerald-100 text-sm">
                      Agora tens um canal seguro (simulado) entre {alice.name || alice.email} e{" "}
                      {bob.name || bob.email}.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
