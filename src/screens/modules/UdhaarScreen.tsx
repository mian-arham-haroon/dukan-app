import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "../../components/AppButton";
import {
  AppCard,
  AppHeader,
  AppInput,
  EmptyState,
  LoadingState,
} from "../../components/ui";
import {
  getCustomerLedger,
  getUdhaarCustomers,
  receiveCustomerPayment,
} from "../../database/udhaarRepository";
import type { UdhaarCustomer, UdhaarLedgerEntry } from "../../types/udhaar";

function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/,/g, "");

  if (!cleaned) {
    return 0;
  }

  const parsed = Number(cleaned);

  if (Number.isNaN(parsed)) {
    return -1;
  }

  return parsed;
}

export function UdhaarScreen() {
  const [customers, setCustomers] = useState<UdhaarCustomer[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<UdhaarLedgerEntry[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedCustomer = useMemo(() => {
    return (
      customers.find((customer) => customer.id === selectedCustomerId) ?? null
    );
  }, [customers, selectedCustomerId]);

  const totalUdhaar = useMemo(() => {
    return customers.reduce(
      (sum, customer) => sum + customer.current_balance,
      0
    );
  }, [customers]);

  const customersWithBalance = useMemo(() => {
    return customers.filter((customer) => customer.current_balance > 0).length;
  }, [customers]);

  async function loadData(nextCustomerId?: string) {
    try {
      setLoading(true);
      setError("");

      const customerResult = await getUdhaarCustomers();

      setCustomers(customerResult);

      const targetCustomerId =
        nextCustomerId ||
        selectedCustomerId ||
        customerResult.find((customer) => customer.current_balance > 0)?.id ||
        customerResult[0]?.id ||
        "";

      setSelectedCustomerId(targetCustomerId);

      if (targetCustomerId) {
        const ledgerResult = await getCustomerLedger(targetCustomerId);
        setLedgerEntries(ledgerResult);
      } else {
        setLedgerEntries([]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load udhaar data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSelectCustomer(customerId: string) {
    try {
      setError("");
      setSuccessMessage("");
      setSelectedCustomerId(customerId);

      const ledgerResult = await getCustomerLedger(customerId);
      setLedgerEntries(ledgerResult);
    } catch (ledgerError) {
      setError(
        ledgerError instanceof Error
          ? ledgerError.message
          : "Failed to load customer ledger."
      );
    }
  }

  async function handleReceivePayment() {
    setError("");
    setSuccessMessage("");

    if (!selectedCustomer) {
      setError("Select a customer first.");
      return;
    }

    const parsedAmount = parseNumber(paymentAmount);

    if (parsedAmount <= 0) {
      setError("Payment amount must be greater than 0.");
      return;
    }

    if (parsedAmount > selectedCustomer.current_balance) {
      setError("Payment cannot be greater than current balance.");
      return;
    }

    try {
      setSaving(true);

      await receiveCustomerPayment({
        customerId: selectedCustomer.id,
        amount: parsedAmount,
        note,
      });

      setPaymentAmount("");
      setNote("");
      setSuccessMessage("Payment received successfully.");

      await loadData(selectedCustomer.id);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Failed to receive payment."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading udhaar records..." />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Customer debt"
              title="Udhaar"
              subtitle="Track customer balances, unpaid invoices, and received payments."
            />

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Total udhaar</Text>
                <Text style={styles.summaryValue}>Rs {totalUdhaar}</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Customers pending</Text>
                <Text style={styles.summaryValue}>{customersWithBalance}</Text>
              </View>
            </View>
          </AppCard>

          {customers.length === 0 ? (
            <EmptyState
              title="No customers yet"
              message="Add customers first, then unpaid invoices will appear here."
            />
          ) : (
            <>
              <AppCard style={styles.sectionCard}>
                <Text style={styles.cardTitle}>Customers</Text>

                <View style={styles.customerGrid}>
                  {customers.map((customer) => (
                    <Pressable
                      key={customer.id}
                      onPress={() => handleSelectCustomer(customer.id)}
                      style={[
                        styles.customerOption,
                        selectedCustomerId === customer.id &&
                          styles.customerOptionActive,
                      ]}
                    >
                      <View style={styles.customerTopRow}>
                        <Text
                          style={[
                            styles.customerName,
                            selectedCustomerId === customer.id &&
                              styles.customerNameActive,
                          ]}
                        >
                          {customer.name}
                        </Text>

                        {customer.current_balance > 0 ? (
                          <View style={styles.dueBadge}>
                            <Text style={styles.dueBadgeText}>Due</Text>
                          </View>
                        ) : (
                          <View style={styles.clearBadge}>
                            <Text style={styles.clearBadgeText}>Clear</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.customerMeta}>
                        Phone: {customer.phone || "N/A"}
                      </Text>

                      <Text style={styles.customerBalance}>
                        Rs {customer.current_balance}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </AppCard>

              <AppCard style={styles.sectionCard}>
                <Text style={styles.cardTitle}>Receive payment</Text>

                {selectedCustomer ? (
                  <>
                    <View style={styles.selectedCustomerBox}>
                      <Text style={styles.selectedCustomerLabel}>
                        Selected customer
                      </Text>
                      <Text style={styles.selectedCustomerName}>
                        {selectedCustomer.name}
                      </Text>
                      <Text style={styles.selectedCustomerBalance}>
                        Current balance: Rs {selectedCustomer.current_balance}
                      </Text>
                    </View>

                    <AppInput
                      label="Payment amount"
                      placeholder="Example: 500"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="numeric"
                    />

                    <AppInput
                      label="Note"
                      placeholder="Example: Cash received"
                      value={note}
                      onChangeText={setNote}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    {successMessage ? (
                      <Text style={styles.successText}>{successMessage}</Text>
                    ) : null}

                    <AppButton
                      title={saving ? "Saving payment..." : "Receive payment"}
                      onPress={handleReceivePayment}
                    />
                  </>
                ) : (
                  <Text style={styles.mutedText}>Select a customer first.</Text>
                )}
              </AppCard>

              <AppCard style={styles.sectionCard}>
                <Text style={styles.cardTitle}>Ledger history</Text>

                {!selectedCustomer ? (
                  <Text style={styles.mutedText}>Select a customer first.</Text>
                ) : ledgerEntries.length === 0 ? (
                  <Text style={styles.mutedText}>
                    No unpaid invoices or payments found for this customer.
                  </Text>
                ) : (
                  <View style={styles.ledgerList}>
                    {ledgerEntries.map((entry) => (
                      <View key={entry.id} style={styles.ledgerItem}>
                        <View style={styles.ledgerLeft}>
                          <View
                            style={[
                              styles.ledgerDot,
                              entry.type === "payment"
                                ? styles.paymentDot
                                : styles.invoiceDot,
                            ]}
                          />

                          <View style={styles.ledgerTextBox}>
                            <Text style={styles.ledgerTitle}>{entry.title}</Text>
                            <Text style={styles.ledgerDescription}>
                              {entry.description}
                            </Text>
                            <Text style={styles.ledgerDate}>
                              {new Date(entry.created_at).toLocaleString()}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.ledgerAmount,
                            entry.type === "payment"
                              ? styles.paymentAmount
                              : styles.invoiceAmount,
                          ]}
                        >
                          {entry.type === "payment" ? "-" : "+"} Rs{" "}
                          {entry.amount}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </AppCard>
            </>
          )}
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
    maxWidth: 900,
    alignSelf: "center",
  },
  headerCard: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionCard: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  customerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  customerOption: {
    minWidth: 220,
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  customerOptionActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  customerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  customerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  customerNameActive: {
    color: "#1D4ED8",
  },
  customerMeta: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
  },
  customerBalance: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  dueBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dueBadgeText: {
    color: "#B91C1C",
    fontSize: 11,
    fontWeight: "800",
  },
  clearBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearBadgeText: {
    color: "#15803D",
    fontSize: 11,
    fontWeight: "800",
  },
  selectedCustomerBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  selectedCustomerLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  selectedCustomerName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  selectedCustomerBalance: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "700",
    marginBottom: 14,
  },
  successText: {
    fontSize: 13,
    color: "#15803D",
    fontWeight: "700",
    marginBottom: 14,
  },
  mutedText: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 21,
  },
  ledgerList: {
    gap: 10,
  },
  ledgerItem: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  ledgerLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  ledgerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
  },
  invoiceDot: {
    backgroundColor: "#DC2626",
  },
  paymentDot: {
    backgroundColor: "#16A34A",
  },
  ledgerTextBox: {
    flex: 1,
  },
  ledgerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 3,
  },
  ledgerDescription: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
    lineHeight: 19,
  },
  ledgerDate: {
    fontSize: 12,
    color: "#94A3B8",
  },
  ledgerAmount: {
    fontSize: 15,
    fontWeight: "900",
  },
  invoiceAmount: {
    color: "#B91C1C",
  },
  paymentAmount: {
    color: "#15803D",
  },
});