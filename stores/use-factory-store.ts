import { create } from "zustand";
import type { Factory } from "@/app/settings/types";

interface FactoryState {
  factory: Factory | null;
  setFactory: (factory: Factory | null) => void;
}

export const useFactoryStore = create<FactoryState>((set) => ({
  factory: null,
  setFactory: (factory) => set({ factory }),
}));

