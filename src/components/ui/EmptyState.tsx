import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../AppButton";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
        <Text style={[styles.iconText, { color: theme.primary }]}>＋</Text>
      </View>

      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  iconText: {
    fontSize: 28,
    fontWeight: "800",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: 18,
    alignSelf: "stretch",
  },
});
