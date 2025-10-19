import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "./api";

interface User {
  id: string;
  name?: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setUser: (u: User) => void;
  setTokens: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setUser: (u) => set({ user: u }),
      setTokens: (token) => set({ accessToken: token }),
      async login(email, password) {
        const { data } = await api.post("/auth/login", { email, password });
        set({ user: data.user, accessToken: data.accessToken });
      },
      async register(name, email, password) {
        const { data } = await api.post("/auth/register", { name, email, password });
        set({ user: data.user, accessToken: data.accessToken });
      },
      logout() {
        api.post("/auth/logout-all").catch(() => {});
        set({ user: null, accessToken: null });
      },
    }),
    { name: "spark-chat-auth" }
  )
);
