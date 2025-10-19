"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NewChatPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data } = await api.get("/users");
        setUsers(data);
      } catch (err) {
        console.error("Erro ao carregar utilizadores:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  async function startChat(userId: string) {
    try {
      const { data } = await api.post("/chat", {
        isGroup: false,
        participantIds: [userId],
      });
      router.push(`/chat/${data.id}`);
    } catch (err) {
      console.error("Erro ao criar chat:", err);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        <Loader2 className="animate-spin w-6 h-6 mr-2" /> A carregar utilizadores...
      </div>
    );

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Nova mensagem</h1>
      <div className="space-y-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => startChat(u.id)}
            className="block w-full text-left p-3 bg-white rounded border hover:bg-gray-50"
          >
            <p className="font-medium">{u.name || u.email}</p>
            <p className="text-sm text-gray-500">{u.email}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
