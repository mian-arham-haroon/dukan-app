import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = {
  message?: string;
};

export function LoadingState({ message = "Loading..." }: Props) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    marginTop: 12,
    fontSize: 14,
  },
});