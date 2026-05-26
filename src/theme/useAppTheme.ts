import { useContext } from "react";
import { lightTheme } from "./theme";
import { ThemeContext, ThemeContextValue } from "./ThemeProvider";

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context) {
    return context;
  }

  return {
    theme: lightTheme,
    mode: "light",
    toggleTheme: () => {},
    setThemeMode: async () => {},
  };
}
