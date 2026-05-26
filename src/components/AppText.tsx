import React from "react";
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from "react-native";
import { useAppTheme } from "../theme/useAppTheme";

type Variant = "body" | "label" | "title" | "subtitle" | "caption";
type Tone = "primary" | "secondary" | "muted" | "success" | "danger" | "warning";

type Props = TextProps & {
  variant?: Variant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
};

const variantStyles: Record<Variant, TextStyle> = {
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
};

export function AppText({
  variant = "body",
  tone = "primary",
  style,
  children,
  ...rest
}: Props) {
  const { theme } = useAppTheme();
  const toneColor =
    tone === "secondary"
      ? theme.textSecondary
      : tone === "muted"
      ? theme.textMuted
      : tone === "success"
      ? theme.success
      : tone === "danger"
      ? theme.danger
      : tone === "warning"
      ? theme.warning
      : theme.textPrimary;

  return (
    <Text
      style={[styles.base, variantStyles[variant], { color: toneColor }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: "#0F172A",
  },
});
