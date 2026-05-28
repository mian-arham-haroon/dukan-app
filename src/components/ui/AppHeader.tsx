import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function AppHeader({ eyebrow, title, subtitle }: Props) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
  },
});
