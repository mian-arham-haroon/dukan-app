import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ModuleRouteName } from "../../navigation/RootNavigator";
import { AppCard, AppHeader, EmptyState } from "../../components/ui";

type Props = {
  moduleKey: ModuleRouteName;
};

const moduleInfo: Record<
  ModuleRouteName,
  {
    eyebrow: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyMessage: string;
    nextItems: string[];
  }
> = {
  Products: {
    eyebrow: "Inventory",
    title: "Products",
    description:
      "Manage product names, selling price, cost price, stock quantity, SKU, barcode, and low-stock alerts.",
    emptyTitle: "No products yet",
    emptyMessage:
      "In the next database phase, this screen will show products saved in local SQLite.",
    nextItems: [
      "Add product form",
      "Product list",
      "Edit product",
      "Stock quantity tracking",
    ],
  },
  Customers: {
    eyebrow: "Customer records",
    title: "Customers",
    description:
      "Manage customer profiles, phone numbers, opening balance, credit limit, and udhaar history.",
    emptyTitle: "No customers yet",
    emptyMessage:
      "In the next phases, customers will be saved locally first, then synced to Supabase later.",
    nextItems: [
      "Add customer form",
      "Customer list",
      "Customer balance",
      "Customer ledger",
    ],
  },
  Invoices: {
    eyebrow: "Sales",
    title: "Invoices",
    description:
      "Create sales invoices, add products, calculate totals, handle paid, partial, and unpaid invoices.",
    emptyTitle: "No invoices yet",
    emptyMessage:
      "Invoice creation will come after products and customers are connected with local SQLite.",
    nextItems: [
      "Create invoice",
      "Add invoice items",
      "Calculate total",
      "Save invoice locally",
    ],
  },
  Udhaar: {
    eyebrow: "Customer debt",
    title: "Udhaar",
    description:
      "Track unpaid invoices, partial payments, received payments, and remaining customer balance.",
    emptyTitle: "No udhaar records yet",
    emptyMessage:
      "Customer balance and payment history will be generated from invoices and payments.",
    nextItems: [
      "Customer ledger",
      "Receive payment",
      "Partial payment",
      "Remaining balance",
    ],
  },
  Expenses: {
    eyebrow: "Cash out",
    title: "Expenses",
    description:
      "Record shop expenses, cash out entries, daily expense totals, and cashbook impact.",
    emptyTitle: "No expenses yet",
    emptyMessage:
      "Expense entries will later update the local cashbook automatically.",
    nextItems: [
      "Add expense",
      "Expense list",
      "Cash out entry",
      "Daily expense total",
    ],
  },
  Settings: {
    eyebrow: "App setup",
    title: "Settings",
    description:
      "Manage business profile, store info, currency, language, backup status, and sync settings.",
    emptyTitle: "Settings not configured yet",
    emptyMessage:
      "Business setup, store setup, currency, and sync status will be added step by step.",
    nextItems: [
      "Business profile",
      "Store setup",
      "Currency PKR",
      "Backup and sync status",
    ],
  },
};

export function ModulePlaceholderScreen({ moduleKey }: Props) {
  const info = moduleInfo[moduleKey];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.heroCard}>
            <AppHeader
              eyebrow={info.eyebrow}
              title={info.title}
              subtitle={info.description}
            />
          </AppCard>

          <EmptyState
            title={info.emptyTitle}
            message={info.emptyMessage}
          />

          <AppCard style={styles.nextCard}>
            <Text style={styles.cardTitle}>What we will build here</Text>

            {info.nextItems.map((item, index) => (
              <View key={item} style={styles.listItem}>
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>{index + 1}</Text>
                </View>

                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </AppCard>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Build order</Text>
            <Text style={styles.warningText}>
              This screen is intentionally not connected to fake data. Fake data
              looks nice but creates confusion. We will connect real local SQLite
              data in the database phase, then add Supabase sync later.
            </Text>
          </View>
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
    maxWidth: 760,
    alignSelf: "center",
  },
  heroCard: {
    marginBottom: 16,
  },
  nextCard: {
    marginTop: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  numberText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  listText: {
    fontSize: 15,
    color: "#334155",
    fontWeight: "600",
  },
  warningBox: {
    backgroundColor: "#FFF7ED",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#C2410C",
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#9A3412",
  },
});