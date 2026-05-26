import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "../components/AppButton";
import { Screen } from "../components/Screen";
import { colors, radius, spacing } from "../constants/theme";

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

export function LoginScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.badge}>DUKAN PRO</Text>
        <Text style={styles.title}>Run your shop without paper chaos.</Text>
        <Text style={styles.subtitle}>
          Manage invoices, inventory, udhaar, cashbook, expenses, and daily
          sales from one simple app.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Start Testing</Text>
        <Text style={styles.cardText}>
          Authentication will connect with Supabase later. For now, this screen
          helps us test navigation and UI.
        </Text>

        <AppButton
          title="Go to Dashboard"
          onPress={() => navigation.navigate("Dashboard")}
        />

        <AppButton
          title="Create Account"
          variant="secondary"
          onPress={() => navigation.navigate("CreateAccount")}
        />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Phase 2</Text>
        <Text style={styles.infoText}>
          Navigation and UI structure are being prepared before adding local
          SQLite database.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  badge: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40,
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  infoBox: {
    backgroundColor: colors.softBlue,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  infoTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});