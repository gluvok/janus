import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type EntityMode = "automatic" | "manual";
export type ModeEntity = "entries" | "weighments";

interface ModeStoreState {
  modes: Record<ModeEntity, EntityMode>;
  setMode: (entity: ModeEntity, mode: EntityMode) => void;
}

export const useModeStore = create<ModeStoreState>()(
  persist(
    (set) => ({
      modes: {
        entries: "automatic",
        weighments: "automatic",
      },
      setMode: (entity, mode) =>
        set((state) => ({
          modes: {
            ...state.modes,
            [entity]: mode,
          },
        })),
    }),
    {
      name: "mesto_entity_mode",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({ modes: state.modes }),
    },
  ),
);
