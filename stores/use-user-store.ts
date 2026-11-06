import { create } from "zustand";
import type { User } from "@/app/users/types";
import type { Factory } from "@/app/settings/types";

interface UserState {
  user: User | null;
  factory: Factory | null;
  setUser: (user: User | null) => void;
  setFactory: (factory: Factory | null) => void;
  setSession: (session: { user: User; factory: Factory }) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  factory: null,
  setUser: (user) => set({ user }),
  setFactory: (factory) => set({ factory }),
  setSession: ({ user, factory }) => set({ user, factory }),
}));
