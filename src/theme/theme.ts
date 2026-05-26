export type ThemeMode = "light" | "dark";

export type AppTheme = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  card: string;
  cardMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  primary: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  inputBackground: string;
  buttonText: string;
  primaryText: string;
  disabled: string;
  shadow: string;
};

export type Theme = AppTheme;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export const lightTheme: AppTheme = {
  background: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#EEF3F8",
  card: "#FFFFFF",
  cardMuted: "#F1F5F9",
  textPrimary: "#111827",
  textSecondary: "#475569",
  textMuted: "#64748B",
  border: "#DDE5EF",
  borderStrong: "#CBD5E1",
  primary: "#2563EB",
  primarySoft: "#EAF2FF",
  success: "#16803D",
  successSoft: "#E8F8EE",
  warning: "#B7791F",
  warningSoft: "#FFF7E6",
  danger: "#D92D20",
  dangerSoft: "#FDECEC",
  inputBackground: "#FFFFFF",
  buttonText: "#FFFFFF",
  primaryText: "#FFFFFF",
  disabled: "#94A3B8",
  shadow: "#000000",
};

export const darkTheme: Theme = {
  background: "#07111F",
  surface: "#0B1626",
  surfaceElevated: "#132033",
  surfaceMuted: "#16243A",
  card: "#0F1B2D",
  cardMuted: "#17263B",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#9AA8BC",
  border: "#26364D",
  borderStrong: "#3A4B63",
  primary: "#60A5FA",
  primarySoft: "#102D55",
  success: "#34D399",
  successSoft: "#123D2F",
  warning: "#FBBF24",
  warningSoft: "#4A3511",
  danger: "#FB7185",
  dangerSoft: "#4A1722",
  inputBackground: "#0A1524",
  buttonText: "#FFFFFF",
  primaryText: "#FFFFFF",
  disabled: "#64748B",
  shadow: "#000000",
};
