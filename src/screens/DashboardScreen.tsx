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

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </View>
  );
}

export function DashboardScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Today&apos;s business overview</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <StatCard label="Today Sales" value="Rs 0" helper="No invoices yet" />
        <StatCard label="Customer Udhaar" value="Rs 0" helper="No dues yet" />
        <StatCard label="Low Stock" value="0" helper="No products yet" />
        <StatCard label="Cash in Hand" value="Rs 0" helper="Cashbook empty" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>

        <AppButton title="Create Invoice" onPress={() => {}} />
        <AppButton title="Add Product" variant="secondary" onPress={() => {}} />
        <AppButton title="Add Customer" variant="secondary" onPress={() => {}} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next Build Steps</Text>
        <Text style={styles.listItem}>1. Add products screen</Text>
        <Text style={styles.listItem}>2. Add customers screen</Text>
        <Text style={styles.listItem}>3. Add local SQLite database</Text>
        <Text style={styles.listItem}>4. Save real data offline</Text>
      </View>

      <AppButton
        title="Back to Login"
        variant="secondary"
        onPress={() => navigation.navigate("Login")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
  },
  grid: {
    marginBottom: spacing.md,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 4,
  },
  statHelper: {
    color: colors.textMuted,
    fontSize: 13,
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
    fontSize: 21,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  listItem: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 8,
  },
});