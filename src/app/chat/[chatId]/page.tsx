"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Send, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store";

interface Message {
  id: string;
  chatId: string;
  authorId: string;
  text?: string | null;
  createdAt: string;
  author?: { name?: string | null; email: string };
}

export default function ChatWindow() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // === Carregar mensagens + subscrever socket ===
  useEffect(() => {
    let mounted = true;

    async function loadMessages() {
      try {
        const { data } = await api.get(`/chat/${chatId}/messages`);
        if (mounted) setMessages(data);
      } catch (err) {
        console.error("Erro ao carregar mensagens:", err);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();

    const socket = getSocket();
    socket.emit("chat:join", { chatId });
    socket.on("message:new", (msg: Message) => {
      if (msg.chatId === chatId) setMessages((prev) => [...prev, msg]);
    });

    return () => {
      mounted = false;
      socket.off("message:new");
    };
  }, [chatId]);

  // === Scroll automático para o fim ===
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // === Enviar mensagem ===
  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/chat/message", { chatId, type: "TEXT", text });
      setText("");
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        <Loader2 className="animate-spin w-8 h-8 mr-2" />
        <p>A carregar mensagens...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header simples */}
      <header className="bg-white border-b p-4 shadow-sm">
        <h1 className="text-lg font-semibold">Conversa</h1>
      </header>

      {/* Área de mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            Nenhuma mensagem ainda. Envia a primeira! 💬
          </p>
        )}

        {messages.map((m) => {
          const isMine = m.authorId === user?.id;
          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs md:max-w-md rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  isMine
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white text-gray-800 border rounded-bl-none"
                }`}
              >
                <p>{m.text}</p>
                <span className="block text-[11px] opacity-70 mt-1 text-right">
                  {new Date(m.createdAt).toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input de envio */}
      <div className="p-4 bg-white border-t flex gap-2">
        <input
          className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Escrever mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={sending}
          className={`bg-blue-600 text-white p-2 rounded-full transition hover:bg-blue-700 ${
            sending ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
