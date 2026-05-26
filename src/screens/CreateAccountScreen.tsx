import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "../components/AppButton";
import { Screen } from "../components/Screen";
import { colors, radius, spacing } from "../constants/theme";

type Props = {
  navigation: {
    goBack: () => void;
    navigate: (screen: string) => void;
  };
};

export function CreateAccountScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Signup UI will connect with Supabase Auth later. Right now we are
          building the app safely phase by phase.
        </Text>

        <View style={styles.stepBox}>
          <Text style={styles.stepTitle}>Upcoming Signup Fields</Text>
          <Text style={styles.stepText}>Owner name</Text>
          <Text style={styles.stepText}>Phone number</Text>
          <Text style={styles.stepText}>Email address</Text>
          <Text style={styles.stepText}>Password</Text>
          <Text style={styles.stepText}>Business name</Text>
        </View>

        <AppButton
          title="Continue to Dashboard"
          onPress={() => navigation.navigate("Dashboard")}
        />

        <AppButton
          title="Back to Login"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.lg,
  },
  stepBox: {
    backgroundColor: colors.softGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 6,
  },
});