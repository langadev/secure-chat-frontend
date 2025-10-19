"use client";
import Sidebar from "@/components/Sidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar fixa à esquerda */}
      <Sidebar />
      {/* Área principal (mensagens ou placeholder) */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
