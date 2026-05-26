import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type {
  ModuleRouteName,
  RootStackParamList,
} from "../../navigation/RootNavigator";
import { AppButton } from "../../components/AppButton";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

const modules: Array<{
  title: string;
  route: ModuleRouteName;
  description: string;
}> = [
  {
    title: "Products",
    route: "Products",
    description: "Manage items, prices, stock, SKU, and low-stock alerts.",
  },
  {
    title: "Customers",
    route: "Customers",
    description: "Manage customers, phone numbers, balance, and credit.",
  },
  {
    title: "Invoices",
    route: "Invoices",
    description: "Create sales invoices, receipts, and unpaid bills.",
  },
  {
    title: "Udhaar",
    route: "Udhaar",
    description: "Track customer debt, partial payments, and ledgers.",
  },
  {
    title: "Expenses",
    route: "Expenses",
    description: "Record shop expenses and cash-out entries.",
  },
  {
    title: "Settings",
    route: "Settings",
    description: "Business profile, store setup, currency, and sync status.",
  },
];

export function DashboardScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();

  const isWide = width >= 900;
  const isMedium = width >= 640;

  const cardWidth = isWide ? "31.5%" : isMedium ? "48.5%" : "100%";
  const moduleWidth = isWide ? "48.5%" : "100%";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Business overview</Text>
            <Text style={styles.heroTitle}>Dashboard</Text>
            <Text style={styles.heroSubtitle}>
              A clean starting point for your invoicing, inventory, udhaar, and
              business reports app.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { width: cardWidth }]}>
              <Text style={styles.statLabel}>Today Sales</Text>
              <Text style={styles.statValue}>Rs 0</Text>
            </View>

            <View style={[styles.statCard, { width: cardWidth }]}>
              <Text style={styles.statLabel}>Customer Udhaar</Text>
              <Text style={styles.statValue}>Rs 0</Text>
            </View>

            <View style={[styles.statCard, { width: cardWidth }]}>
              <Text style={styles.statLabel}>Low Stock Items</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Main Modules</Text>
            <Text style={styles.sectionSubtitle}>
              Open each module. Real SQLite data will be connected in later
              phases.
            </Text>

            <View style={styles.moduleGrid}>
              {modules.map((item) => (
                <Pressable
                  key={item.route}
                  onPress={() => navigation.navigate(item.route)}
                  style={({ pressed }) => [
                    styles.moduleCard,
                    { width: moduleWidth },
                    pressed && styles.pressed,
                  ]}
                >
                  <View>
                    <Text style={styles.moduleTitle}>{item.title}</Text>
                    <Text style={styles.moduleDescription}>
                      {item.description}
                    </Text>
                  </View>

                  <Text style={styles.moduleArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <AppButton
            title="Reports"
            onPress={() => navigation.navigate("Reports")}
            style={styles.backButton}
          />

          <AppButton
            title="Back to Login"
            variant="secondary"
            onPress={() => navigation.navigate("Login")}
            style={styles.backButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 20,
  },
  wrapper: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "#64748B",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  statLabel: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#64748B",
    marginBottom: 16,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  moduleCard: {
    minHeight: 108,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  moduleDescription: {
    maxWidth: 380,
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  moduleArrow: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2563EB",
    marginLeft: 12,
  },
  backButton: {
    marginTop: 6,
  },
});