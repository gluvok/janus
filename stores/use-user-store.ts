import { create } from "zustand";
import type { User } from "@/app/users/types";

interface UserState {
  user: User | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setInitialized: (initialized: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isInitialized: false,
  setUser: (user) => set({ user, isInitialized: true }),
  setInitialized: (isInitialized) => set({ isInitialized }),
}));
