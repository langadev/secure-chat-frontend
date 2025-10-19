// src/app/chat/[chatId]/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { encryptMessage, decryptMessage } from "@/lib/clientCrypto";
import { getChatKey, saveChatKey } from "@/lib/chatStorage";
import { Send, Loader2, ShieldCheck, ShieldOff, User, Lock, AlertCircle, MoreVertical } from "lucide-react";
import { useAuthStore } from "@/lib/store";

interface Message {
  id: string;
  chatId: string;
  authorId: string;
  text: string | null;
  createdAt: string;
  author?: {
    id: string;
    name?: string | null;
    email: string;
  };
}

interface ChatInfo {
  id: string;
  title?: string | null;
  isGroup: boolean;
  participants: {
    user: {
      id: string;
      name?: string | null;
      email: string;
    }
  }[];
  myEncryptedAes?: string;
}

export default function ChatWindow() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aesKey, setAesKey] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // 1) Carrega chave AES e mensagens
  useEffect(() => {
    let mounted = true;
    
    async function loadChatData() {
      setLoading(true);
      setKeyStatus('loading');
      
      try {
        const [chatRes, messagesRes] = await Promise.all([
          api.get(`/chat/${chatId}`),
          api.get(`/chat/${chatId}/messages`),
        ]);

        if (!mounted) return;

        setChatInfo(chatRes.data);
        setMessages(messagesRes.data);

        // Tenta pegar do localStorage primeiro
        let key = getChatKey(String(chatId));

        // Se não houver local, tenta do backend
        const serverKey = chatRes.data?.myEncryptedAes ?? null;
        if (!key && serverKey) {
          key = serverKey;
          saveChatKey(String(chatId), key);
        }

        if (key) {
          setAesKey(key);
          setKeyStatus('success');
        } else {
          setKeyStatus('error');
          console.warn("⚠️ Nenhuma chave AES encontrada");
        }
      } catch (e) {
        console.error("Erro ao carregar chat:", e);
        if (mounted) setKeyStatus('error');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadChatData();
    return () => { mounted = false; };
  }, [chatId]);

  

  // 2) Scroll inteligente para o final
  useEffect(() => {
    if (!scrollRef.current) return;
    
    const scrollElement = scrollRef.current;
    const isNearBottom = 
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 100;
    
    if (isNearBottom) {
      requestAnimationFrame(() => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      });
    }
  }, [messages]);

  // 3) Enviar mensagem cifrada
  async function sendMessage() {
    if (!text.trim() || !aesKey) return;

    setSending(true);
    try {
      const encrypted = await encryptMessage(text, aesKey);
      const response = await api.post("/chat/message", {
        chatId,
        type: "TEXT",
        text: encrypted,
      });
      
      // Adiciona a mensagem localmente
      setMessages(prev => [...prev, response.data]);
      setText("");
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    } finally {
      setSending(false);
    }
  }

  const getChatTitle = () => {
    if (!chatInfo) return "Chat Seguro";
    if (chatInfo.title) return chatInfo.title;
    
    const otherParticipants = chatInfo.participants
      .filter(p => p.user.id !== user?.id)
      .map(p => p.user.name || p.user.email.split('@')[0]);
    
    return otherParticipants.join(", ") || "Chat Seguro";
  };

  const getParticipantCount = () => {
    if (!chatInfo) return "";
    return `${chatInfo.participants.length} ${chatInfo.participants.length === 1 ? 'participante' : 'participantes'}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center text-gray-600">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="animate-spin w-12 h-12 mb-4 text-blue-600 mx-auto" />
            <Lock className="w-6 h-6 text-blue-500 absolute top-3 left-1/2 transform -translate-x-1/2" />
          </div>
          <p className="text-lg font-medium">A preparar chat seguro...</p>
          <p className="text-sm text-gray-500 mt-1">A verificar chaves de criptografia</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header melhorado */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                keyStatus === 'success' 
                  ? 'bg-gradient-to-r from-green-500 to-blue-500' 
                  : keyStatus === 'error'
                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                  : 'bg-gradient-to-r from-gray-400 to-gray-500'
              }`}>
                {keyStatus === 'success' ? (
                  <ShieldCheck className="w-5 h-5 text-white" />
                ) : keyStatus === 'error' ? (
                  <ShieldOff className="w-5 h-5 text-white" />
                ) : (
                  <Lock className="w-5 h-5 text-white" />
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 rounded-full p-1 border-2 border-white ${
                keyStatus === 'success' ? 'bg-green-500' : 
                keyStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`}>
                <Lock className="w-2 h-2 text-white" />
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-gray-800">{getChatTitle()}</h1>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  keyStatus === 'success' 
                    ? 'bg-green-100 text-green-700' 
                    : keyStatus === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {keyStatus === 'success' ? 'Cifrado' : 
                   keyStatus === 'error' ? 'Erro de Chave' : 'Carregando...'}
                </span>
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <User className="w-3 h-3" />
                {getParticipantCount()}
              </p>
            </div>
          </div>
          
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </header>

      {/* Área de mensagens */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center max-w-md">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                keyStatus === 'success' ? 'bg-green-100' : 
                keyStatus === 'error' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                {keyStatus === 'success' ? (
                  <ShieldCheck className="w-8 h-8 text-green-500" />
                ) : keyStatus === 'error' ? (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                ) : (
                  <Lock className="w-8 h-8 text-gray-500" />
                )}
              </div>
              
              {keyStatus === 'success' ? (
                <>
                  <h3 className="font-semibold text-gray-700 mb-2">Chat Seguro</h3>
                  <p className="text-gray-600 mb-4">
                    Todas as mensagens são cifradas de ponta-a-ponta. 
                    Envia a primeira mensagem segura!
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-700 mb-2">Problema de Segurança</h3>
                  <p className="text-gray-600 mb-4">
                    Não foi possível carregar a chave de criptografia. 
                    Algumas mensagens podem não ser visíveis.
                  </p>
                </>
              )}
              
              <div className={`text-sm flex items-center justify-center gap-2 ${
                keyStatus === 'success' ? 'text-green-600' : 
                keyStatus === 'error' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {keyStatus === 'success' ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Protegido com criptografia E2E
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Verifique a conexão e tente novamente
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          messages.map(m => (
            <MessageBubble key={m.id} m={m} aesKey={aesKey} currentUserId={user?.id} />
          ))
        )}
      </div>

      {/* Input area melhorada */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200/60">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-3">
            <input
              className={`flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all duration-200 ${
                keyStatus === 'success'
                  ? 'border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white'
                  : 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-transparent bg-red-50'
              }`}
              placeholder={
                keyStatus === 'success' 
                  ? "Escrever mensagem segura..." 
                  : "Chave de criptografia indisponível..."
              }
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={keyStatus !== 'success'}
            />
            
            <button
              onClick={sendMessage}
              disabled={!text.trim() || sending || keyStatus !== 'success'}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center ${
                sending || !text.trim() || keyStatus !== 'success'
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600 shadow-lg hover:shadow-xl transform hover:scale-105"
              }`}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {/* Status e dicas */}
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-xs text-gray-500">
              Pressione <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 rounded border">Enter</kbd> para enviar
            </p>
            
            <div className={`text-xs flex items-center gap-1 ${
              keyStatus === 'success' ? 'text-green-600' : 
              keyStatus === 'error' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {keyStatus === 'success' ? (
                <>
                  <ShieldCheck className="w-3 h-3" />
                  Cifrado de ponta-a-ponta
                </>
              ) : keyStatus === 'error' ? (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Criptografia indisponível
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  A carregar chaves...
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, aesKey, currentUserId }: { m: Message; aesKey: string | null; currentUserId?: string }) {
  const [plainText, setPlainText] = useState("…");
  const [decryptionStatus, setDecryptionStatus] = useState<'decrypting' | 'success' | 'error'>('decrypting');
  const [showAuthor, setShowAuthor] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function decryptMessageContent() {
      try {
        setDecryptionStatus('decrypting');
        
        if (!aesKey || !m.text) {
          if (!mounted) return;
          setPlainText(m.text ? "🔑 Chave indisponível" : "📝");
          setDecryptionStatus('error');
          return;
        }

        const decrypted = await decryptMessage(m.text, aesKey);
        if (!mounted) return;
        
        setPlainText(decrypted);
        setDecryptionStatus('success');
      } catch (e) {
        console.error("Falha ao decifrar mensagem:", e);
        if (!mounted) return;
        setPlainText("🔒 Mensagem cifrada (indisponível)");
        setDecryptionStatus('error');
      }
    }

    decryptMessageContent();

    return () => { mounted = false; };
  }, [m.text, aesKey]);

  useEffect(() => {
    // Mostrar autor se disponível e não for o usuário atual
    setShowAuthor(!!m.author && m.author.id !== currentUserId && !!m.author.name);
  }, [m.author, currentUserId]);

  const isMine = m.authorId === currentUserId;

  return (
    <div className={`flex gap-3 ${isMine ? "justify-end" : "justify-start"}`}>
      {/* Avatar para mensagens de outros */}
      {!isMine && (
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mt-1">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
      
      <div className={`max-w-xs md:max-w-md lg:max-w-lg ${isMine ? "order-first" : ""}`}>
        {/* Nome do autor */}
        {showAuthor && (
          <p className="text-xs font-medium text-gray-600 mb-1 ml-1">
            {m.author?.name}
          </p>
        )}
        
        {/* Bolha da mensagem */}
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200 ${
            isMine
              ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md"
              : "bg-white text-gray-800 border border-gray-200/80 rounded-bl-md"
          } ${decryptionStatus === 'decrypting' ? 'opacity-80' : ''}`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm leading-relaxed break-words">
                {decryptionStatus === 'decrypting' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    A decifrar...
                  </span>
                ) : (
                  plainText
                )}
              </p>
            </div>
            
            {/* Ícone de status de segurança */}
            <div className="flex-shrink-0 mt-0.5">
              {decryptionStatus === 'success' ? (
                <ShieldCheck className="w-4 h-4 text-green-400" />
              ) : decryptionStatus === 'error' ? (
                <ShieldOff className="w-4 h-4 text-red-400" />
              ) : (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              )}
            </div>
          </div>
          
          <span
            className={`block text-xs mt-1.5 ${
              isMine ? "text-blue-100" : "text-gray-500"
            }`}
          >
            {new Date(m.createdAt).toLocaleTimeString("pt-PT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}