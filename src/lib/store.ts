import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { mmkvStorage } from "./storage";

export const useWalletStore = create()(
  persist(
    (set) => ({
      favorites: [],
      addFavorite: (address: string) => set((state: any) => ({ favorites: [...state.favorites, address] })),
      removeFavorite: (address: string) => set((state: any) => ({ favorites: state.favorites.filter((a: string) => a !== address) })),
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
