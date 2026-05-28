import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/ui/AppCard";
import { AppHeader } from "../components/ui/AppHeader";
import { Screen } from "../components/Screen";
import { useAppTheme } from "../theme/useAppTheme";

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
};

function StatCard({ label, value, helper }: StatCardProps) {
  const { theme } = useAppTheme();

  return (
    <AppCard style={styles.statCard}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value}</Text>
      <Text style={[styles.statHelper, { color: theme.textMuted }]}>{helper}</Text>
    </AppCard>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const { theme } = useAppTheme();

  return (
    <Screen>
      <AppCard style={styles.headerCard}>
        <AppHeader
          eyebrow="Overview"
          title="Dashboard"
          subtitle="Today’s business overview"
        />
      </AppCard>

      <View style={styles.grid}>
        <StatCard label="Today Sales" value="Rs 0" helper="No invoices yet" />
        <StatCard label="Customer Udhaar" value="Rs 0" helper="No dues yet" />
        <StatCard label="Low Stock" value="0" helper="No products yet" />
        <StatCard label="Cash in Hand" value="Rs 0" helper="Cashbook empty" />
      </View>

      <AppCard style={styles.modulesCard}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Modules</Text>

        <View style={styles.buttonGrid}>
          <View style={styles.buttonCell}>
            <AppButton title="Products" variant="secondary" onPress={() => navigation.navigate("Products")} />
          </View>
          <View style={styles.buttonCell}>
            <AppButton title="Customers" variant="secondary" onPress={() => navigation.navigate("Customers")} />
          </View>
          <View style={styles.buttonCell}>
            <AppButton title="Invoices" variant="secondary" onPress={() => navigation.navigate("Invoices")} />
          </View>
          <View style={styles.buttonCell}>
            <AppButton title="Udhaar" variant="secondary" onPress={() => navigation.navigate("Udhaar")} />
          </View>
          <View style={styles.buttonCell}>
            <AppButton title="Expenses" variant="secondary" onPress={() => navigation.navigate("Expenses")} />
          </View>
          <View style={styles.buttonCell}>
            <AppButton title="Settings" variant="secondary" onPress={() => navigation.navigate("Settings")} />
          </View>
        </View>
      </AppCard>

      <View style={styles.actionRow}>
        <AppButton title="Reports" variant="primary" onPress={() => navigation.navigate("Reports")} style={styles.actionButton} />
        <AppButton title="Back to Login" variant="secondary" onPress={() => navigation.navigate("Login")} style={styles.actionButton} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginBottom: 20,
  },
  grid: {
    marginBottom: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    width: "48%",
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
  },
  statHelper: {
    fontSize: 13,
    lineHeight: 20,
  },
  modulesCard: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginHorizontal: -6,
  },
  buttonCell: {
    width: "48%",
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 160,
  },
});