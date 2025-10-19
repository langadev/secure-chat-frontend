"use client";

import { useState } from "react";
import {
  Key,
  Shield,
  Lock,
  Fingerprint,
  FileText,
  RefreshCw,
  Download,
  Settings,
  Users,
  Activity,
  CheckCircle2,
  Globe,
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"dh" | "cert" | "security" | "about">("dh");

  const tabs = [
    { id: "dh", label: "Diffie-Hellman", icon: Key },
    { id: "cert", label: "Certificados Digitais", icon: Shield },
    { id: "security", label: "Segurança", icon: Lock },
    { id: "about", label: "Sobre", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      {/* Header */}
      <header className="px-8 py-6 border-b border-gray-200 bg-white/70 backdrop-blur-md flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <Settings className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Centro de Configurações
          </h1>
        </div>
        <Link
          href="/chat"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <Users className="w-4 h-4" /> Voltar às Conversas
        </Link>
      </header>

      <div className="max-w-6xl mx-auto mt-10 flex flex-col md:flex-row gap-8 px-6 pb-20">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 h-fit">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Categorias</h2>
          <div className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-500"}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-white rounded-2xl border border-gray-200 shadow p-8 space-y-6">
          {activeTab === "dh" && (
            <>
              <div className="flex items-center gap-2">
                <Key className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-800">
                  Configurações de Diffie-Hellman
                </h2>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                Gere e visualize parâmetros usados para a troca de chaves seguras. 
                Aqui pode testar a geração de chaves, pares primos e derivação AES.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  🔐 Aceder ao simulador visual de troca de chaves:
                </p>
                <Link
                  href="/dh-demo"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  <Key className="w-4 h-4" />
                  Abrir Simulador Diffie-Hellman
                </Link>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                <p>• Parâmetros padrão: Grupo 14 (2048-bit), g=2</p>
                <p>• Hash derivado via SHA-256</p>
              </div>
            </>
          )}

          {activeTab === "cert" && (
            <>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-800">
                  Certificados Digitais
                </h2>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                Gira os certificados digitais locais, gere novos e exporte em formato PEM. 
                Este módulo usa criptografia RSA-2048 e assinatura SHA-256.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <p className="text-sm text-gray-700">📜 Gerar e testar certificados:</p>
                <Link
                  href="/cert-demo"
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  <FileText className="w-4 h-4" />
                  Abrir Simulador de Certificados
                </Link>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Chaves Locais</h4>
                  <p className="text-xs text-gray-500 mb-2">
                    As chaves geradas são armazenadas apenas no navegador.
                  </p>
                  <button className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                    Exportar Chave Pública
                  </button>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Assinaturas</h4>
                  <p className="text-xs text-gray-500 mb-2">
                    Verifique a validade e a integridade de assinaturas.
                  </p>
                  <button className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200">
                    Verificar Assinatura
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "security" && (
            <>
              <div className="flex items-center gap-2">
                <Lock className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-800">Segurança e Logs</h2>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed">
                Monitoriza atividades de segurança locais e preferências de encriptação.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600" /> Atividade Recente
                  </h4>
                  <ul className="text-xs text-gray-700 space-y-1">
                    <li>• Geração de chave DH - 09:45</li>
                    <li>• Verificação de certificado - 09:48</li>
                    <li>• Nova sessão encriptada - 10:03</li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" /> Preferências
                  </h4>
                  <label className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                    <input type="checkbox" defaultChecked className="rounded" /> Encriptação automática
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                    <input type="checkbox" className="rounded" /> Limpar chaves ao sair
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" className="rounded" /> Mostrar logs detalhados
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === "about" && (
            <>
              <div className="flex items-center gap-2">
                <Globe className="w-6 h-6 text-slate-600" />
                <h2 className="text-xl font-semibold text-gray-800">Sobre o Sistema</h2>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed max-w-3xl">
                Este painel integra os módulos de segurança do sistema SparkTech Secure Chat, 
                incluindo a troca de chaves Diffie-Hellman e emissão de certificados digitais. 
                O objetivo é demonstrar conceitos de criptografia aplicada, 
                autenticação e integridade de dados em comunicações seguras.
              </p>

              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p>Versão do sistema: <span className="font-mono text-gray-700">v1.0.3</span></p>
                <p>Última atualização: 20 de Outubro de 2025</p>
                <p>Desenvolvido por: <span className="font-medium text-gray-700">SparkTech Security Labs</span></p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
