import { create } from "zustand";

interface ThemeState {
  isLight: boolean;
  toggleTheme: () => void;
}

const stored = localStorage.getItem("theme") === "light";
if (stored) document.documentElement.classList.add("light");

export const useThemeStore = create<ThemeState>((set) => ({
  isLight: stored,
  toggleTheme: () =>
    set((state) => {
      const next = !state.isLight;
      document.documentElement.classList.toggle("light", next);
      localStorage.setItem("theme", next ? "light" : "dark");
      return { isLight: next };
    }),
}));