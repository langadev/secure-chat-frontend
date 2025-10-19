"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { MessageSquarePlus, MessageSquare, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import NewChatModal from "./NewChatModal";

interface Chat {
  id: string;
  title?: string | null;
  participants: { user: { name?: string | null; email: string } }[];
  lastMessageAt?: string | null;
}

export default function Sidebar() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNewChat, setOpenNewChat] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function loadChats() {
    try {
      const { data } = await api.get("/chat/mine");
      setChats(data);
    } catch (err) {
      console.error("Erro ao carregar chats:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChats();
  }, []);

  function handleOpenNewChat() {
    setOpenNewChat(true);
  }

  async function handleChatCreated(chatId: string) {
    // Atualiza lista e navega para o novo chat
    await loadChats();
    setOpenNewChat(false);
    router.push(`/chat/${chatId}`);
  }

  return (
    <>
      <aside className="w-72 bg-white border-r shadow-sm flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Conversas</h2>
          <button
            onClick={handleOpenNewChat}
            className="text-blue-600 hover:text-blue-800 transition"
            title="Nova mensagem"
          >
            <MessageSquarePlus className="w-6 h-6" />
          </button>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Loader2 className="animate-spin w-6 h-6 mb-2" />
              <p>A carregar...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <MessageSquare className="w-6 h-6 mx-auto mb-2" />
              <p>Sem conversas</p>
            </div>
          ) : (
            chats.map((chat) => {
              const subtitle =
                chat.title ||
                chat.participants.map((p) => p.user.name ?? p.user.email).join(", ");
              const isActive = pathname === `/chat/${chat.id}`;
              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={`block px-4 py-3 border-b cursor-pointer ${
                    isActive
                      ? "bg-blue-50 border-l-4 border-blue-600 text-blue-700"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <p className="font-medium truncate">{subtitle}</p>
                  <p className="text-xs text-gray-500">
                    {chat.lastMessageAt
                      ? new Date(chat.lastMessageAt).toLocaleTimeString("pt-PT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Sem mensagens"}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </aside>

      {/* Modal "Nova mensagem" */}
      <NewChatModal
        open={openNewChat}
        onClose={() => setOpenNewChat(false)}
        onCreated={handleChatCreated}
      />
    </>
  );
}
