import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { AppStackParamList } from "../../navigation/AppNavigator";

type ModuleRouteName =
  | "Products"
  | "Customers"
  | "Invoices"
  | "Udhaar"
  | "Expenses"
  | "Settings";

type Props = NativeStackScreenProps<AppStackParamList, ModuleRouteName>;

const MODULE_TEXT: Record<ModuleRouteName, string> = {
  Products:
    "Products module will handle items, stock quantity, cost price, selling price, and low stock alerts.",
  Customers:
    "Customers module will handle customer profiles, phone numbers, balances, and udhaar history.",
  Invoices:
    "Invoices module will handle sales, invoice items, totals, payments, and stock reduction.",
  Udhaar:
    "Udhaar module will handle customer debt, partial payments, remaining balance, and ledger history.",
  Expenses:
    "Expenses module will handle shop expenses, cash out entries, and daily expense reports.",
  Settings:
    "Settings module will handle business profile, currency, language, backup status, and app preferences.",
};

export function ModulePlaceholderScreen({ route }: Props) {
  const title = route.name;
  const description = MODULE_TEXT[title];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Phase status</Text>
        <Text style={styles.noticeText}>
          This screen is only a placeholder. Real data will come after the local
          SQLite database phase.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    marginBottom: 20,
  },
  noticeBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1D4ED8",
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1E3A8A",
  },
});