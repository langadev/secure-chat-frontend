"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, X } from "lucide-react";

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (chatId: string) => void;
}

interface User {
  id: string;
  name?: string | null;
  email: string;
}

export default function NewChatModal({ open, onClose, onCreated }: NewChatModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Ajusta se tiveres endpoint de pesquisa: ex. /users?query=...
        const { data } = await api.get("/users");
        if (mounted) setUsers(data);
      } catch (e) {
        console.error("Erro ao carregar utilizadores:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      setQ("");
      setCreatingId(null);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
    );
  }, [users, q]);

  async function startChat(userId: string) {
    try {
      setCreatingId(userId);
      const { data } = await api.post("/chat", {
        isGroup: false,
        participantIds: [userId],
      });
      onCreated(data.id);
    } catch (err) {
      console.error("Erro ao criar chat:", err);
    } finally {
      setCreatingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* modal */}
      <div className="absolute inset-x-0 top-20 mx-auto w-[min(32rem,92vw)] rounded-xl bg-white shadow-xl border">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-base font-semibold">Nova mensagem</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* campo de pesquisa */}
        <div className="p-4 border-b">
          <input
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Procurar por nome ou email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* lista de utilizadores */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              A carregar utilizadores…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sem resultados.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-3 px-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.name || u.email}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => startChat(u.id)}
                    disabled={creatingId === u.id}
                    className={`text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition ${
                      creatingId === u.id ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  >
                    {creatingId === u.id ? "A criar…" : "Iniciar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* rodapé */}
        <div className="p-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
