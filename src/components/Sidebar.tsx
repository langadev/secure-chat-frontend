"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { 
  MessageSquarePlus, 
  MessageSquare, 
  Loader2, 
  Users, 
  Search,
  Clock,
  Shield,
  User,
  MoreVertical
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import NewChatModal from "./NewChatModal";

interface Chat {
  id: string;
  title?: string | null;
  participants: { user: { name?: string | null; email: string } }[];
  lastMessageAt?: string | null;
  _count?: { messages: number };
  isGroup?: boolean;
}

export default function Sidebar() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openNewChat, setOpenNewChat] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function loadChats() {
    try {
      const { data } = await api.get("/chat/mine");
      setChats(data);
      setFilteredChats(data);
    } catch (err) {
      console.error("Erro ao carregar chats:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChats();
  }, []);

  // Filtro de busca
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = chats.filter(chat => {
      const title = chat.title?.toLowerCase() || '';
      const participants = chat.participants
        .map(p => p.user.name?.toLowerCase() || p.user.email.toLowerCase())
        .join(' ');
      
      return title.includes(query) || participants.includes(query);
    });
    
    setFilteredChats(filtered);
  }, [searchQuery, chats]);

  function handleOpenNewChat() {
    setOpenNewChat(true);
  }

  async function handleChatCreated(chatId: string) {
    await loadChats();
    setOpenNewChat(false);
    router.push(`/chat/${chatId}`);
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString("pt-PT", { weekday: "short" });
    } else {
      return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
    }
  };

  const getChatSubtitle = (chat: Chat) => {
    if (chat.title) return chat.title;
    
    const participants = chat.participants.map(p => 
      p.user.name || p.user.email.split('@')[0]
    );
    
    return participants.join(", ");
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <aside className="w-80 bg-gradient-to-b from-white to-gray-50/80 border-r border-gray-200/60 flex flex-col h-full">
        {/* Cabeçalho */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Mensagens
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {chats.length} {chats.length === 1 ? 'conversa' : 'conversas'}
              </p>
            </div>
            <button
              onClick={handleOpenNewChat}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2.5 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              title="Nova conversa"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de pesquisa */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Pesquisar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
            />
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <Loader2 className="animate-spin w-8 h-8 mb-3 text-blue-500" />
              <p className="text-sm">A carregar conversas...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 p-4 text-center">
              {searchQuery ? (
                <>
                  <Search className="w-8 h-8 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Nenhuma conversa encontrada</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tente ajustar os termos da pesquisa
                  </p>
                </>
              ) : (
                <>
                  <MessageSquare className="w-8 h-8 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Sem conversas</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Inicia uma nova conversa para começar
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredChats.map((chat) => {
                const subtitle = getChatSubtitle(chat);
                const isActive = pathname === `/chat/${chat.id}`;
                const lastMessageTime = chat.lastMessageAt ? formatTime(chat.lastMessageAt) : null;
                const messageCount = chat._count?.messages || 0;

                return (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    className={`block p-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50 shadow-sm"
                        : "hover:bg-white hover:shadow-sm hover:border hover:border-gray-200/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar do chat */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                        chat.isGroup 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      }`}>
                        {chat.isGroup ? (
                          <Users className="w-5 h-5 text-white" />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${
                              isActive ? "text-blue-700" : "text-gray-800"
                            }`}>
                              {subtitle}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {messageCount > 0 && (
                                <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                                  {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
                                </span>
                              )}
                              {chat.isGroup && (
                                <Shield className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                          </div>
                          
                          {/* Timestamp e menu */}
                          <div className="flex flex-col items-end gap-1">
                            {lastMessageTime && (
                              <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {lastMessageTime}
                              </span>
                            )}
                            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all duration-200">
                              <MoreVertical className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer com informações do usuário */}
        <div className="p-4 border-t border-gray-200/60 bg-white/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-gray-600 to-gray-400 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-medium">
                {getInitials("Utilizador")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">Utilizador</p>
              <p className="text-xs text-gray-500 truncate">Online</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Modal "Nova conversa" */}
      <NewChatModal
        open={openNewChat}
        onClose={() => setOpenNewChat(false)}
        onCreated={handleChatCreated}
      />
    </>
  );
}