"use client";

import { useEffect, useState } from "react";
import {
  FileText, Key, Shield, Lock, Play, Pause, RefreshCw, Download,
  Eye, EyeOff, CheckCircle, AlertCircle, Fingerprint, Calendar, User
} from "lucide-react";
import { api } from "@/lib/api";

const toBase64 = (ab: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(ab)));
const toHex = (ab: ArrayBuffer) =>
  Array.from(new Uint8Array(ab)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

const getFutureDate = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
};

interface ApiUser {
  id: string;
  name?: string;
  email: string;
  organization?: string;
}

export default function CertificateDemo() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [issuerId, setIssuerId] = useState<string>("");

  const [certData, setCertData] = useState<any>(null);
  const [keys, setKeys] = useState<{ publicKey?: CryptoKey; privateKey?: CryptoKey }>({});
  const [fingerprint, setFingerprint] = useState("");
  const [signature, setSignature] = useState("");
  const [verified, setVerified] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);

  const AC_LIST = [
    { id: "ac-br", name: "Autoridade Certificadora Nacional", email: "ac@brasil.gov", organization: "Governo BR" },
    { id: "ac-mz", name: "AC Moçambique", email: "certificados@acmz.gov.mz", organization: "Gov. Moçambique" },
    { id: "ac-global", name: "GlobalTrust CA", email: "support@globaltrust.com", organization: "GlobalTrust" }
  ];

  const steps = [
    "Seleção de Titular e Autoridade Certificadora",
    "Geração do Par de Chaves RSA-2048",
    "Criação da Requisição (CSR)",
    "Assinatura Digital pela Autoridade Certificadora",
    "Verificação da Assinatura",
    "Emissão do Certificado Final"
  ];

  // === Fetch dos utilizadores ===
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiUser[]>("/users");
        setUsers(res.data);
      } catch {
        console.warn("⚠️ Falha ao buscar utilizadores da API (modo demo).");
      }
    })();
  }, []);

  // === Atualiza dados do certificado ===
  useEffect(() => {
    if (!subjectId || !issuerId) return;
    const subject = users.find(u => u.id === subjectId);
    const issuer = AC_LIST.find(a => a.id === issuerId);
    if (!subject || !issuer) return;

    const serial = Math.floor(Math.random() * 1e16).toString(16).toUpperCase();
    setCertData({
      subject,
      issuer,
      validity: {
        from: new Date().toISOString().split("T")[0],
        to: getFutureDate(1),
      },
      serial,
    });
  }, [subjectId, issuerId, users]);

  // === Automação dos passos ===
  useEffect(() => {
    let timer: any;
    if (isPlaying && currentStep < steps.length - 1) {
      timer = setInterval(() => setCurrentStep(s => Math.min(s + 1, steps.length - 1)), speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentStep, speed]);

  // === Criptografia real com WebCrypto ===
  useEffect(() => {
    if (!certData) return;

    (async () => {
      if (currentStep === 1) {
        const pair = await crypto.subtle.generateKey(
          { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
          true,
          ["sign", "verify"]
        );
        setKeys(pair);
        const pub = await crypto.subtle.exportKey("spki", pair.publicKey);
        const digest = await crypto.subtle.digest("SHA-256", pub);
        setFingerprint(toHex(digest));
      }

      if (currentStep === 3 && keys.privateKey) {
        const msg = new TextEncoder().encode(JSON.stringify(certData));
        const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, msg);
        setSignature(toBase64(sig));
      }

      if (currentStep === 4 && keys.publicKey && signature) {
        const msg = new TextEncoder().encode(JSON.stringify(certData));
        const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
        const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", keys.publicKey, sigBytes, msg);
        setVerified(ok);
      }
    })();
  }, [currentStep, certData, keys, signature]);

  const reset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    setKeys({});
    setSignature("");
    setVerified(false);
    setFingerprint("");
    setCertData(null);
    setSubjectId("");
    setIssuerId("");
  };

  const download = async () => {
    if (!keys.publicKey) return;
    const pub = await crypto.subtle.exportKey("spki", keys.publicKey);
    const pem = `-----BEGIN CERTIFICATE-----\n${toBase64(pub)}\n-----END CERTIFICATE-----`;
    const blob = new Blob([pem], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "certificate.pem";
    a.click();
    URL.revokeObjectURL(url);
  };

  // === UI ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Cabeçalho */}
        <header className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-green-500 to-emerald-600 bg-clip-text text-transparent drop-shadow-sm">
            Simulador PKI com Dados da API
          </h1>
          <p className="text-gray-700 mt-3 text-lg">
            Gera e assina certificados digitais reais com dados da tua API (RSA-2048 + SHA-256).
          </p>
        </header>

        {/* Seleção */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow border border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-green-500" /> Selecionar Participantes
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600 font-medium">Titular do Certificado</label>
              <select
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
                className="w-full mt-1 p-3 border border-gray-300 text-gray-600  rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Escolher --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 font-medium">Autoridade Certificadora</label>
              <select
                value={issuerId}
                onChange={e => setIssuerId(e.target.value)}
                className="w-full mt-1 p-3 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="">-- Escolher --</option>
                {AC_LIST.map(ac => (
                  <option key={ac.id} value={ac.id}>{ac.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Controlos */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow p-6 flex flex-col sm:flex-row gap-4 justify-between border border-gray-200">
          <div className="flex gap-2">
            <button onClick={() => setCurrentStep(s => Math.max(0, s - 1))} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              Anterior
            </button>
            <button
              onClick={() => setIsPlaying(p => !p)}
              className={`px-4 py-2 rounded-lg text-white shadow ${isPlaying ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-600 hover:bg-blue-700"}`}
              disabled={!certData}
            >
              {isPlaying ? "Pausar" : "Iniciar"}
            </button>
            <button
              onClick={() => setCurrentStep(s => Math.min(s + 1, steps.length - 1))}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              disabled={!certData}
            >
              Próximo
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Velocidade:</span>
            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value={2000}>Lenta</option>
              <option value={1000}>Normal</option>
              <option value={500}>Rápida</option>
            </select>
            <button onClick={reset} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow">
              Reiniciar
            </button>
          </div>
        </div>

        {/* Certificado */}
        {certData && (
          <div className="relative overflow-hidden rounded-2xl shadow-lg border border-gray-300">
            {/* Banner decorativo */}
            <div className="bg-gradient-to-r from-green-600 via-blue-600 to-indigo-600 p-5 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-wide">CERTIFICADO DIGITAL</h2>
                <p className="text-sm opacity-90">{certData.issuer.name}</p>
              </div>
              {verified ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-300" />
                  <span className="font-medium">Válido</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-yellow-300" />
                  <span className="font-medium">Em verificação</span>
                </div>
              )}
            </div>

            {/* Corpo */}
            <div className="bg-white p-8 grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-blue-600" /> Titular
                </h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 shadow-sm">
                  <p><strong>Nome:</strong> {certData.subject.name}</p>
                  <p><strong>Email:</strong> {certData.subject.email}</p>
                  <p><strong>Organização:</strong> {certData.subject.organization || "—"}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-green-600" /> Emissor (AC)
                </h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 shadow-sm">
                  <p><strong>Nome:</strong> {certData.issuer.name}</p>
                  <p><strong>Email:</strong> {certData.issuer.email}</p>
                  <p><strong>Org:</strong> {certData.issuer.organization}</p>
                </div>
              </div>
            </div>

            {/* Metadados */}
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-8 py-4 text-sm text-gray-800 border-t border-gray-200 flex flex-col gap-1">
              <p>Válido de <strong>{certData.validity.from}</strong> até <strong>{certData.validity.to}</strong></p>
              <p>Série: <span className="font-mono text-gray-700">{certData.serial}</span></p>
            </div>

            {/* Criptografia */}
            <div className="bg-white p-8 border-t border-gray-200 space-y-4">
              {fingerprint && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-green-600" /> Fingerprint (SHA-256)
                  </h3>
                  <div className="p-3 bg-gray-50 border rounded font-mono text-xs break-all text-gray-700">{fingerprint}</div>
                </div>
              )}

              {signature && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" /> Assinatura Digital
                  </h3>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded font-mono text-xs break-all text-blue-900">
                    {signature}
                  </div>
                </div>
              )}

              {/* Private Key */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Key className="w-5 h-5 text-orange-500" /> Chave Privada
                </h3>
                <div className="p-3 bg-red-50 border border-red-200 rounded font-mono text-xs h-24 overflow-y-auto text-red-900">
                  {showPrivate ? "Chave privada RSA-2048 (mantém confidencial)" : "••••••••••••••••••••••••••••••"}
                </div>
                <button
                  onClick={() => setShowPrivate(s => !s)}
                  className="text-xs text-gray-600 mt-1 hover:text-gray-800 flex items-center gap-1"
                >
                  {showPrivate ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPrivate ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

