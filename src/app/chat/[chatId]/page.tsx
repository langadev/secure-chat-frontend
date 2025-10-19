// src/app/chat/[chatId]/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { encryptMessage, decryptMessage } from "@/lib/clientCrypto";
import { getChatKey, saveChatKey } from "@/lib/chatStorage";
import { Send, Loader2, ShieldCheck, ShieldOff, User, Lock, AlertCircle, MoreVertical, Image as ImageIcon } from "lucide-react";
import { useAuthStore } from "@/lib/store";

interface Message {
  id: string;
  chatId: string;
  authorId: string;
  type: "TEXT" | "IMAGE";
  text: string | null;
  imageUrl?: string | null;
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
    };
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
  const [keyStatus, setKeyStatus] = useState<"loading" | "success" | "error">("loading");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // 📥 Carrega chave AES e mensagens
  useEffect(() => {
    let mounted = true;

    async function loadChatData() {
      setLoading(true);
      setKeyStatus("loading");

      try {
        const [chatRes, messagesRes] = await Promise.all([
          api.get(`/chat/${chatId}`),
          api.get(`/chat/${chatId}/messages`),
        ]);

        if (!mounted) return;

        setChatInfo(chatRes.data);
        setMessages(messagesRes.data);

        // tenta pegar do localStorage primeiro
        let key = getChatKey(String(chatId));

        // se não houver local, tenta do backend
        const serverKey = chatRes.data?.myEncryptedAes ?? null;
        if (!key && serverKey) {
          key = serverKey;
          saveChatKey(String(chatId), key);
        }

        if (key) {
          setAesKey(key);
          setKeyStatus("success");
        } else {
          setKeyStatus("error");
          console.warn("⚠️ Nenhuma chave AES encontrada");
        }
      } catch (e) {
        console.error("Erro ao carregar chat:", e);
        if (mounted) setKeyStatus("error");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadChatData();
    return () => {
      mounted = false;
    };
  }, [chatId]);

  // 🧭 Scroll automático
  useEffect(() => {
    if (!scrollRef.current) return;

    const scrollElement = scrollRef.current;
    const isNearBottom =
      scrollElement.scrollHeight -
        scrollElement.scrollTop -
        scrollElement.clientHeight <
      100;

    if (isNearBottom) {
      requestAnimationFrame(() => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      });
    }
  }, [messages]);

  // 🧠 Enviar mensagem cifrada (texto ou imagem)
async function sendMessage() {
  const chatIdStr = String(chatId); // ✅ garante que é string
  if (!aesKey) return console.warn("⚠️ Sem chave AES");
  if (!text.trim() && !pendingImage) return;

  setSending(true);
  try {
    let payload: any;

    if (pendingImage) {
      const fd = new FormData();
      fd.append("image", pendingImage);
      const uploadRes = await api.post("/upload/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ Corrige para URL absoluta
      const fullUrl = uploadRes.data.url.startsWith("http")
        ? uploadRes.data.url
        : `${process.env.NEXT_PUBLIC_API_URL}${uploadRes.data.url}`;

      payload = {
        chatId: chatIdStr,
        type: "IMAGE",
        imageUrl: fullUrl,
      };
    } else {
      const encrypted = await encryptMessage(text, aesKey);
      payload = {
        chatId: chatIdStr,
        type: "TEXT",
        text: encrypted,
      };
    }

    console.log("🚀 Payload final:", payload);
    const r = await api.post("/chat/message", payload);
    setMessages((prev) => [...prev, r.data]);
    setText("");
    setPendingImage(null);
  } catch (err: any) {
    console.error("❌ Erro ao enviar:", err.response?.data || err.message);
  } finally {
    setSending(false);
  }
}



  // 📁 Upload de imagem
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImage(file);
      setText(file.name);
    }
  }

  const getChatTitle = () => {
    if (!chatInfo) return "Chat Seguro";
    if (chatInfo.title) return chatInfo.title;

    const otherParticipants = chatInfo.participants
      .filter((p) => p.user.id !== user?.id)
      .map((p) => p.user.name || p.user.email.split("@")[0]);

    return otherParticipants.join(", ") || "Chat Seguro";
  };

  const getParticipantCount = () => {
    if (!chatInfo) return "";
    return `${chatInfo.participants.length} ${
      chatInfo.participants.length === 1 ? "participante" : "participantes"
    }`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center text-gray-600">
        <Loader2 className="animate-spin w-12 h-12 mb-4 text-blue-600" />
        <p>A preparar chat seguro...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          {keyStatus === "success" ? (
            <ShieldCheck className="text-green-500 w-6 h-6" />
          ) : keyStatus === "error" ? (
            <ShieldOff className="text-red-500 w-6 h-6" />
          ) : (
            <Loader2 className="animate-spin w-6 h-6 text-gray-500" />
          )}
          <div>
            <h1 className="font-semibold text-gray-800">{getChatTitle()}</h1>
            <p className="text-xs text-gray-500">{getParticipantCount()}</p>
          </div>
        </div>
        <MoreVertical className="text-gray-500" />
      </header>

      {/* MENSAGENS */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              aesKey={aesKey}
              currentUserId={user?.id}
            />
          ))
        )}
      </div>

      {/* INPUT */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200/60 flex items-center gap-3">
        <label className="cursor-pointer">
          <ImageIcon className="w-6 h-6 text-blue-500 hover:text-blue-600 transition" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>

        <input
          className="flex-1 border rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Escrever mensagem segura..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && sendMessage()
          }
          disabled={keyStatus !== "success"}
        />

        <button
          onClick={sendMessage}
          disabled={sending || (!text.trim() && !pendingImage)}
          className={`p-3 rounded-xl flex items-center justify-center transition ${
            sending || (!text.trim() && !pendingImage)
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600"
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

function MessageBubble({
  m,
  aesKey,
  currentUserId,
}: {
  m: Message;
  aesKey: string | null;
  currentUserId?: string;
}) {
  const [plain, setPlain] = useState("…");
  const [ok, setOk] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (m.type === "IMAGE") {
          setPlain(m.imageUrl ?? "");
          setOk(true);
          return;
        }
        if (!aesKey || !m.text) {
          setPlain("🔑 Sem chave");
          setOk(false);
          return;
        }
        const t = await decryptMessage(m.text, aesKey);
        if (!mounted) return;
        setPlain(t);
        setOk(true);
      } catch {
        if (!mounted) return;
        setPlain("🔒 Mensagem cifrada (indisponível)");
        setOk(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [m.id, m.text, aesKey]);

  const isMine = m.authorId === currentUserId;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-sm px-3 py-2 rounded-xl shadow text-sm ${
          isMine
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-white border border-gray-200 rounded-bl-md"
        }`}
      >
        {m.type === "IMAGE" ? (
          <img
            src={plain}
            alt="imagem enviada"
            className="rounded-lg max-w-[240px] max-h-[240px] object-cover"
          />
        ) : (
          <p>{plain}</p>
        )}
        <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
          {ok ? (
            <ShieldCheck className="w-3 h-3 text-green-400" />
          ) : (
            <ShieldOff className="w-3 h-3 text-red-400" />
          )}
          {new Date(m.createdAt).toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
