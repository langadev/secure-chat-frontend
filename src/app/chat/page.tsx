"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Plus, Users, Clock } from "lucide-react";

interface Chat {
  id: string;
  title?: string | null;
  isGroup: boolean;
  lastMessageAt?: string | null;
  participants: { user: { id: string; name?: string | null; email: string } }[];
  _count?: { messages: number };
}

export default function ChatListPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadChats() {
      try {
        const { data } = await api.get("/chat/mine");
        setChats(data);
      } catch (err) {
        console.error("Erro ao carregar conversas:", err);
      } finally {
        setLoading(false);
      }
    }
    loadChats();
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    } else if (diffInHours < 168) { // 7 dias
      return date.toLocaleDateString("pt-PT", { weekday: "short" });
    } else {
      return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center text-gray-600">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 mb-4 text-blue-600 mx-auto" />
          <p className="text-lg font-medium">A carregar as tuas conversas...</p>
          <p className="text-sm text-gray-500 mt-1">Isto só demora um momento</p>
        </div>
      </div>
    );

  if (!chats.length)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center text-gray-600 p-4">
        <div className="text-center max-w-md">
          <div className="bg-white/80 backdrop-blur-sm rounded-full p-6 w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <MessageSquare className="w-12 h-12 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Sem conversas</h2>
          <p className="text-gray-600 mb-6">
            Ainda não tens conversas. Inicia uma nova conversa para começar a comunicar!
          </p>
          <button
            onClick={() => router.push("/chat/new")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center mx-auto gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova conversa
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Conversas</h1>
            <p className="text-sm text-gray-600 mt-1">
              {chats.length} {chats.length === 1 ? 'conversa' : 'conversas'}
            </p>
          </div>
          <button
            onClick={() => router.push("/chat/new")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova
          </button>
        </div>
      </header>

      {/* Chat List */}
      <main className="max-w-4xl mx-auto p-4 space-y-3">
        {chats.map((chat) => {
          const participants = chat.participants.map((p) => p.user.name ?? p.user.email);
          const subtitle = chat.title || participants.join(", ");
          const messageCount = chat._count?.messages || 0;
          
          return (
            <Link key={chat.id} href={`/chat/${chat.id}`}>
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/60 hover:border-blue-300/50 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {chat.isGroup ? (
                        <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                      <p className="font-semibold text-gray-800 truncate">
                        {subtitle}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                          {messageCount} {messageCount === 1 ? 'mensagem' : 'mensagens'}
                        </span>
                      </span>
                      
                      {chat.lastMessageAt && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      )}
                    </div>

                    {!chat.title && (
                      <p className="text-sm text-gray-500 mt-2 truncate">
                        Com: {participants.join(", ")}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full group-hover:bg-green-500 transition-colors duration-300"></div>
                    <MessageSquare className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </main>

      {/* Floating Action Button for Mobile */}
      <button
        onClick={() => router.push("/chat/new")}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 md:hidden z-20"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}