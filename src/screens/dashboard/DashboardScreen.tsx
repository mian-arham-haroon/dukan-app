import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton } from "../../components/AppButton";
import { AppScreen } from "../../components/AppScreen";
import { AppText } from "../../components/AppText";
import { AppCard } from "../../components/ui";
import type {
  ModuleRouteName,
  RootStackParamList,
} from "../../navigation/RootNavigator";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

const modules: Array<{
  title: string;
  route: ModuleRouteName;
  description: string;
  accent: "primary" | "success" | "warning" | "danger";
}> = [
  {
    title: "Products",
    route: "Products",
    description: "Manage items, prices, stock, SKU, and low-stock alerts.",
    accent: "primary",
  },
  {
    title: "Customers",
    route: "Customers",
    description: "Manage customers, phone numbers, balance, and credit.",
    accent: "success",
  },
  {
    title: "Invoices",
    route: "Invoices",
    description: "Create sales invoices, receipts, and unpaid bills.",
    accent: "warning",
  },
  {
    title: "Udhaar",
    route: "Udhaar",
    description: "Track customer debt, partial payments, and ledgers.",
    accent: "danger",
  },
  {
    title: "Expenses",
    route: "Expenses",
    description: "Record shop expenses and cash-out entries.",
    accent: "warning",
  },
  {
    title: "Settings",
    route: "Settings",
    description: "Business profile, store setup, currency, and sync status.",
    accent: "primary",
  },
];

const stats = [
  { label: "Today Sales", value: "Rs 0", helper: "Current day", accent: "primary" },
  { label: "Customer Udhaar", value: "Rs 0", helper: "Outstanding", accent: "success" },
  { label: "Low Stock Items", value: "0", helper: "Needs review", accent: "warning" },
];

export function DashboardScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();

  const isWide = width >= 900;
  const isMedium = width >= 640;

  const cardWidth = isWide ? "31.5%" : isMedium ? "48.5%" : "100%";
  const moduleWidth = isWide ? "48.5%" : "100%";

  return (
    <AppScreen contentStyle={styles.scrollContent}>
      <View style={styles.wrapper}>
        <AppCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: theme.primarySoft }]}>
              <AppText variant="label" style={{ color: theme.primary }}>
                Business overview
              </AppText>
            </View>
          </View>

          <AppText variant="title" style={styles.heroTitle}>
            Dashboard
          </AppText>

          <AppText tone="secondary" style={styles.heroSubtitle}>
            A clean starting point for your invoicing, inventory, udhaar, and
            business reports app.
          </AppText>

          <View style={styles.heroActions}>
            <AppButton
              title="Reports"
              onPress={() => navigation.navigate("Reports")}
              style={styles.heroButton}
            />

            <AppButton
              title="Back to Login"
              variant="secondary"
              onPress={() => navigation.navigate("Login")}
              style={styles.heroButton}
            />
          </View>
        </AppCard>

        <View style={styles.statsRow}>
          {stats.map((stat) => {
            const accentColor =
              stat.accent === "success"
                ? theme.success
                : stat.accent === "warning"
                ? theme.warning
                : theme.primary;

            return (
              <AppCard
                key={stat.label}
                variant="muted"
                style={[styles.statCard, { width: cardWidth }]}
              >
                <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
                <AppText variant="label" tone="muted">
                  {stat.label}
                </AppText>
                <AppText variant="title" style={styles.statValue}>
                  {stat.value}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {stat.helper}
                </AppText>
              </AppCard>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <AppText variant="title" style={styles.sectionTitle}>
            Main Modules
          </AppText>
          <AppText tone="secondary" style={styles.sectionSubtitle}>
            Open each module. Real SQLite data will be connected in later
            phases.
          </AppText>
        </View>

        <View style={styles.moduleGrid}>
          {modules.map((item) => {
            const accentColor =
              item.accent === "success"
                ? theme.success
                : item.accent === "warning"
                ? theme.warning
                : item.accent === "danger"
                ? theme.danger
                : theme.primary;

            return (
              <Pressable
                key={item.route}
                onPress={() => navigation.navigate(item.route)}
                style={({ pressed }) => [
                  styles.moduleCard,
                  {
                    width: moduleWidth,
                    backgroundColor: theme.card,
                    borderColor: theme.borderStrong,
                    shadowColor: theme.shadow,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.moduleContent}>
                  <View
                    style={[
                      styles.moduleAccent,
                      { backgroundColor: accentColor + "24" },
                    ]}
                  >
                    <Text style={[styles.moduleInitial, { color: accentColor }]}>
                      {item.title.charAt(0)}
                    </Text>
                  </View>

                  <View style={styles.moduleTextBox}>
                    <Text
                      style={[
                        styles.moduleTitle,
                        { color: theme.textPrimary },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.moduleDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.moduleArrow, { color: theme.textSecondary }]}>
                  &gt;
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
  },
  wrapper: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    gap: 16,
  },
  heroCard: {
    padding: 22,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  heroBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 41,
  },
  heroSubtitle: {
    maxWidth: 620,
    marginTop: 8,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },
  heroButton: {
    minWidth: 170,
    flexGrow: 1,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  statCard: {
    minHeight: 132,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  statAccent: {
    width: 38,
    height: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 29,
    lineHeight: 37,
    marginTop: 8,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
  },
  sectionSubtitle: {
    maxWidth: 680,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 13,
  },
  moduleCard: {
    minHeight: 122,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  moduleContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  moduleAccent: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleInitial: {
    fontSize: 20,
    fontWeight: "900",
  },
  moduleTextBox: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  moduleDescription: {
    maxWidth: 380,
    fontSize: 14,
    lineHeight: 21,
  },
  moduleArrow: {
    fontSize: 22,
    fontWeight: "900",
    marginLeft: 12,
  },
});
