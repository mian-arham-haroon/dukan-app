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
import { useAppTheme } from "../../theme/useAppTheme";
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

function formatMoney(value: number): string {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

export function UdhaarScreen() {
  const { theme } = useAppTheme();
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
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Customer debt"
              title="Udhaar"
              subtitle="Track customer balances, unpaid invoices, and received payments."
            />

            <View style={styles.summaryRow}>
              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Total udhaar</Text>
                <Text style={[styles.summaryValue, { color: theme.warning }]}>{formatMoney(totalUdhaar)}</Text>
                <Text style={[styles.summaryHint, { color: theme.textMuted }]}>Customer balance</Text>
              </View>

              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Customers pending</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{customersWithBalance}</Text>
                <Text style={[styles.summaryHint, { color: theme.textMuted }]}>With due amount</Text>
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
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Customers</Text>

                <View style={styles.customerGrid}>
                  {customers.map((customer) => (
                    <Pressable
                      key={customer.id}
                      onPress={() => handleSelectCustomer(customer.id)}
                      style={[
                        styles.customerOption,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        selectedCustomerId === customer.id &&
                          {
                            backgroundColor: theme.primarySoft,
                            borderColor: theme.primary,
                            borderWidth: 2,
                          },
                      ]}
                    >
                      <View style={styles.customerTopRow}>
                        <Text
                          style={[
                            styles.customerName,
                            { color: selectedCustomerId === customer.id ? theme.primary : theme.textPrimary },
                          ]}
                        >
                          {customer.name}
                        </Text>

                        {customer.current_balance > 0 ? (
                          <View style={[styles.dueBadge, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
                            <Text style={[styles.dueBadgeText, { color: theme.danger }]}>Due</Text>
                          </View>
                        ) : (
                          <View style={[styles.clearBadge, { backgroundColor: theme.successSoft, borderColor: theme.success }]}>
                            <Text style={[styles.clearBadgeText, { color: theme.success }]}>Clear</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.customerMeta, { color: selectedCustomerId === customer.id ? theme.textPrimary : theme.textSecondary }]}>
                        Phone: {customer.phone || "N/A"}
                      </Text>

                      <Text style={[styles.customerBalance, { color: theme.textPrimary }]}>
                        {formatMoney(customer.current_balance)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </AppCard>

              <AppCard style={styles.sectionCard}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Receive payment</Text>

                {selectedCustomer ? (
                  <>
                    <View style={[styles.selectedCustomerBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                      <View style={styles.selectedCustomerTopRow}>
                        <View style={styles.selectedCustomerInfo}>
                          <Text style={[styles.selectedCustomerLabel, { color: theme.textMuted }]}>
                            Selected customer
                          </Text>
                          <Text style={[styles.selectedCustomerName, { color: theme.textPrimary }]}>
                            {selectedCustomer.name}
                          </Text>
                        </View>
                        <View style={[styles.selectedBalancePill, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <Text style={[styles.selectedBalanceLabel, { color: theme.textMuted }]}>Balance</Text>
                          <Text style={[styles.selectedBalanceValue, { color: theme.warning }]}>
                            {formatMoney(selectedCustomer.current_balance)}
                          </Text>
                        </View>
                      </View>
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

                    {error ? (
                      <View style={[styles.messageBox, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
                        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                      </View>
                    ) : null}

                    {successMessage ? (
                      <View style={[styles.messageBox, { backgroundColor: theme.successSoft, borderColor: theme.success }]}>
                        <Text style={[styles.successText, { color: theme.success }]}>{successMessage}</Text>
                      </View>
                    ) : null}

                    <AppButton
                      title={saving ? "Saving payment..." : "Receive payment"}
                      onPress={handleReceivePayment}
                      style={styles.paymentButton}
                      fullWidth
                    />
                  </>
                ) : (
                  <Text style={[styles.mutedText, { color: theme.textMuted }]}>Select a customer first.</Text>
                )}
              </AppCard>

              <AppCard style={styles.sectionCard}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Ledger history</Text>

                {!selectedCustomer ? (
                  <Text style={[styles.mutedText, { color: theme.textMuted }]}>Select a customer first.</Text>
                ) : ledgerEntries.length === 0 ? (
                  <Text style={[styles.mutedText, { color: theme.textMuted }]}>
                    No unpaid invoices or payments found for this customer.
                  </Text>
                ) : (
                  <View style={styles.ledgerList}>
                    {ledgerEntries.map((entry) => (
                      <View key={entry.id} style={[styles.ledgerItem, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                        <View style={styles.ledgerLeft}>
                          <View
                            style={[
                              styles.ledgerDot,
                              {
                                backgroundColor:
                                  entry.type === "payment"
                                    ? theme.success
                                    : theme.danger,
                              },
                            ]}
                          />

                          <View style={styles.ledgerTextBox}>
                            <Text style={[styles.ledgerTitle, { color: theme.textPrimary }]}>{entry.title}</Text>
                            <Text style={[styles.ledgerDescription, { color: theme.textSecondary }]}>
                              {entry.description}
                            </Text>
                            <Text style={[styles.ledgerDate, { color: theme.textMuted }]}>
                              {new Date(entry.created_at).toLocaleString()}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.ledgerAmount,
                            entry.type === "payment"
                              ? { color: theme.success }
                              : { color: theme.danger },
                          ]}
                        >
                          {entry.type === "payment" ? "-" : "+"}{" "}
                          {formatMoney(entry.amount)}
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
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  wrapper: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    gap: 16,
  },
  headerCard: {
    borderRadius: 20,
    gap: 14,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    minWidth: 180,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "900",
  },
  summaryHint: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 20,
    gap: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 16,
  },
  customerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  customerOption: {
    minWidth: 220,
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
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
    fontWeight: "900",
  },
  customerMeta: {
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "700",
  },
  customerBalance: {
    fontSize: 22,
    fontWeight: "900",
  },
  dueBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  clearBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  clearBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  selectedCustomerBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  selectedCustomerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  selectedCustomerInfo: {
    flex: 1,
  },
  selectedCustomerLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  selectedCustomerName: {
    fontSize: 18,
    fontWeight: "900",
  },
  selectedBalancePill: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  selectedBalanceLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  selectedBalanceValue: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  successText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  paymentButton: {
    marginTop: 4,
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 21,
  },
  ledgerList: {
    gap: 10,
  },
  ledgerItem: {
    borderWidth: 1,
    borderRadius: 16,
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
  ledgerTextBox: {
    flex: 1,
  },
  ledgerTitle: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },
  ledgerDescription: {
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 19,
  },
  ledgerDate: {
    fontSize: 12,
  },
  ledgerAmount: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
