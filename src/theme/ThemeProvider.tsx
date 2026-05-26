import React, { createContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkTheme, isThemeMode, lightTheme, Theme, ThemeMode } from "./theme";

const THEME_STORAGE_KEY = "@dukan_app_theme_mode";

export type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [theme, setTheme] = useState<Theme>(lightTheme);

  useEffect(() => {
    async function loadThemeMode() {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isThemeMode(storedMode)) {
          setMode(storedMode);
          setTheme(storedMode === "dark" ? darkTheme : lightTheme);
          return;
        }
      } catch {
        // Fallback to light theme if storage is unavailable.
      }

      setMode("light");
      setTheme(lightTheme);
    }

    loadThemeMode();
  }, []);

  const setThemeMode = async (nextMode: ThemeMode) => {
    const safeMode = isThemeMode(nextMode) ? nextMode : "light";

    setMode(safeMode);
    setTheme(safeMode === "dark" ? darkTheme : lightTheme);

    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, safeMode);
    } catch {
      // Ignore storage failures silently.
    }
  };

  const toggleTheme = () => {
    const nextMode = mode === "dark" ? "light" : "dark";
    void setThemeMode(nextMode);
  };

  const contextValue = useMemo(
    () => ({ theme, mode, toggleTheme, setThemeMode }),
    [theme, mode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
