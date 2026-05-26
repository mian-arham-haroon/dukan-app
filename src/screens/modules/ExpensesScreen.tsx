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
  createDailyClose,
  createExpense,
  getCashbookEntries,
  getCashbookSummary,
  getDailyCloses,
  getExpenseEntries,
} from "../../database/expensesRepository";
import type {
  CashbookEntry,
  CashbookSummary,
  DailyClose,
} from "../../types/expense";
import { useAppTheme } from "../../theme/useAppTheme";

const expenseCategories = [
  "Rent",
  "Electricity",
  "Salary",
  "Transport",
  "Food",
  "Repair",
  "Other",
];

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

function formatEntryType(type: string): string {
  if (type === "invoice_payment") return "Invoice payment";
  if (type === "sale_payment") return "Sale payment";
  if (type === "customer_payment") return "Customer payment";
  if (type === "expense") return "Expense";

  return type.replace(/_/g, " ");
}

export function ExpensesScreen() {
  const { theme } = useAppTheme();
  const [summary, setSummary] = useState<CashbookSummary>({
    totalCashIn: 0,
    totalCashOut: 0,
    expectedCash: 0,
    expenseTotal: 0,
    entryCount: 0,
  });

  const [expenses, setExpenses] = useState<CashbookEntry[]>([]);
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[]>([]);
  const [dailyCloses, setDailyCloses] = useState<DailyClose[]>([]);

  const [category, setCategory] = useState("Rent");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [actualCash, setActualCash] = useState("");
  const [closeNote, setCloseNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingClose, setSavingClose] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const parsedAmount = useMemo(() => parseNumber(amount), [amount]);
  const parsedActualCash = useMemo(() => parseNumber(actualCash), [actualCash]);

  const liveDifference = actualCash.trim()
    ? parsedActualCash - summary.expectedCash
    : 0;

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [summaryResult, expenseResult, cashbookResult, closesResult] =
        await Promise.all([
          getCashbookSummary(),
          getExpenseEntries(),
          getCashbookEntries(),
          getDailyCloses(),
        ]);

      setSummary(summaryResult);
      setExpenses(expenseResult);
      setCashbookEntries(cashbookResult);
      setDailyCloses(closesResult);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load cashbook."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveExpense() {
    setError("");
    setSuccessMessage("");

    if (parsedAmount <= 0) {
      setError("Expense amount must be greater than 0.");
      return;
    }

    if (!description.trim()) {
      setError("Expense description is required.");
      return;
    }

    try {
      setSavingExpense(true);

      await createExpense({
        category,
        amount: parsedAmount,
        description,
      });

      setAmount("");
      setDescription("");
      setSuccessMessage("Expense saved successfully.");

      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save expense."
      );
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleDailyClose() {
    setError("");
    setSuccessMessage("");

    if (!actualCash.trim()) {
      setError("Actual cash is required.");
      return;
    }

    if (parsedActualCash < 0) {
      setError("Actual cash must be a valid number.");
      return;
    }

    try {
      setSavingClose(true);

      const result = await createDailyClose({
        actualCash: parsedActualCash,
        note: closeNote,
      });

      setActualCash("");
      setCloseNote("");

      if (result.difference === 0) {
        setSuccessMessage("Daily close saved. Cash matched perfectly.");
      } else if (result.difference > 0) {
        setSuccessMessage(
          `Daily close saved. Extra cash found: Rs ${result.difference}.`
        );
      } else {
        setSuccessMessage(
          `Daily close saved. Cash shortage: Rs ${Math.abs(result.difference)}.`
        );
      }

      await loadData();
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Failed to save daily close."
      );
    } finally {
      setSavingClose(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading cashbook..." />;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Cashflow"
              title="Expenses"
              subtitle="Record expenses, track today cash, and close the day with actual counted cash."
            />

            <View style={styles.summaryGrid}>
              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Today cash in</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>Rs {summary.totalCashIn}</Text>
                <Text style={[styles.summaryHint, { color: theme.textMuted }]}>Collected cash</Text>
              </View>

              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Today cash out</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>Rs {summary.totalCashOut}</Text>
                <Text style={[styles.summaryHint, { color: theme.textMuted }]}>Paid expenses</Text>
              </View>

              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Expected cash</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>Rs {summary.expectedCash}</Text>
                <Text style={[styles.summaryHint, { color: theme.textMuted }]}>Register balance</Text>
              </View>
            </View>
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Daily close</Text>

            <View style={[styles.closeInfoBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <View style={styles.closeInfoRow}>
                <Text style={[styles.closeInfoLabel, { color: theme.textSecondary }]}>Expected cash</Text>
                <Text style={[styles.closeInfoValue, { color: theme.textPrimary }]}>
                  Rs {summary.expectedCash}
                </Text>
              </View>

              <View style={styles.closeInfoRow}>
                <Text style={[styles.closeInfoLabel, { color: theme.textSecondary }]}>Actual cash entered</Text>
                <Text style={[styles.closeInfoValue, { color: theme.textPrimary }]}>
                  Rs {actualCash.trim() ? parsedActualCash : 0}
                </Text>
              </View>

              <View style={styles.closeInfoRow}>
                <Text style={[styles.closeInfoLabel, { color: theme.textSecondary }]}>Difference</Text>
                <Text
                  style={[
                    styles.closeInfoValue,
                    liveDifference === 0
                      ? styles.neutralText
                      : liveDifference > 0
                      ? styles.goodText
                      : styles.badText,
                  ]}
                >
                  {liveDifference >= 0 ? "+" : "-"} Rs{" "}
                  {Math.abs(liveDifference)}
                </Text>
              </View>
            </View>

            <AppInput
              label="Actual cash counted"
              placeholder="Example: 200"
              value={actualCash}
              onChangeText={setActualCash}
              keyboardType="numeric"
            />

            <AppInput
              label="Close note"
              placeholder="Example: Day closed by owner"
              value={closeNote}
              onChangeText={setCloseNote}
            />

            <AppButton
              title={savingClose ? "Saving daily close..." : "Save daily close"}
              onPress={handleDailyClose}
              style={styles.closeButton}
              fullWidth
            />
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Add expense</Text>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Category</Text>
            <View style={styles.categoryGrid}>
              {expenseCategories.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    category === item && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: category === item ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <AppInput
              label="Amount"
              placeholder="Example: 500"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <AppInput
              label="Description"
              placeholder="Example: Shop electricity bill"
              value={description}
              onChangeText={setDescription}
            />

            {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

            {successMessage ? (
              <Text style={[styles.successText, { color: theme.success }]}>{successMessage}</Text>
            ) : null}

            <AppButton
              title={savingExpense ? "Saving expense..." : "Save expense"}
              onPress={handleSaveExpense}
              style={styles.expenseButton}
              fullWidth
            />
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <View style={styles.sectionTopRow}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Recent daily closes</Text>
              <Text style={[styles.sectionMeta, { backgroundColor: theme.primarySoft, color: theme.primary }]}>{dailyCloses.length} closes</Text>
            </View>

            {dailyCloses.length === 0 ? (
              <Text style={[styles.mutedText, { color: theme.textMuted }]}>
                No daily close saved yet. Count your cash and save your first
                daily close above.
              </Text>
            ) : (
              <View style={styles.entryList}>
                {dailyCloses.map((close) => (
                  <View key={close.id} style={[styles.entryItem, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                    <View style={styles.entryLeft}>
                      <View
                        style={[
                          styles.cashbookDot,
                          close.difference === 0
                            ? styles.neutralDot
                            : close.difference > 0
                            ? styles.cashInDot
                            : styles.cashOutDot,
                        ]}
                      />

                      <View style={styles.entryTextBox}>
                        <Text style={[styles.entryTitle, { color: theme.textPrimary }]}>
                          Expected Rs {close.expected_cash} - Actual Rs{" "}
                          {close.actual_cash}
                        </Text>

                        <Text style={[styles.entryDescription, { color: theme.textSecondary }]}>
                          {close.note || "No note"}
                        </Text>

                        <Text style={[styles.entryDate, { color: theme.textMuted }]}>
                          {new Date(close.closed_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.cashbookAmount,
                        close.difference === 0
                          ? { color: theme.textPrimary, backgroundColor: theme.card }
                          : close.difference > 0
                          ? { color: theme.success, backgroundColor: theme.successSoft }
                          : { color: theme.danger, backgroundColor: theme.dangerSoft },
                      ]}
                    >
                      {close.difference >= 0 ? "+" : "-"} Rs{" "}
                      {Math.abs(close.difference)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <View style={styles.sectionTopRow}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Recent expenses</Text>
              <Text style={[styles.sectionMeta, { backgroundColor: theme.primarySoft, color: theme.primary }]}>Rs {summary.expenseTotal}</Text>
            </View>

            {expenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                message="Add rent, electricity, salary, transport, or other shop expenses here."
              />
            ) : (
              <View style={styles.entryList}>
                {expenses.map((entry) => (
                  <View key={entry.id} style={[styles.entryItem, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                    <View style={styles.entryLeft}>
                      <View style={styles.expenseDot} />

                      <View style={styles.entryTextBox}>
                        <Text style={[styles.entryTitle, { color: theme.textPrimary }]}>{entry.description}</Text>
                        <Text style={[styles.entryDate, { color: theme.textMuted }]}>
                          {new Date(entry.entry_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.expenseAmount, { color: theme.danger, backgroundColor: theme.dangerSoft }]}>
                      - Rs {entry.amount_out}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <View style={styles.sectionTopRow}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Cashbook</Text>
              <Text style={[styles.sectionMeta, { backgroundColor: theme.primarySoft, color: theme.primary }]}>
                {cashbookEntries.length} entries
              </Text>
            </View>

            {cashbookEntries.length === 0 ? (
              <Text style={[styles.mutedText, { color: theme.textMuted }]}>
                Cashbook is empty. Paid invoices, customer payments, and expenses
                will appear here.
              </Text>
            ) : (
              <View style={styles.entryList}>
                {cashbookEntries.map((entry) => {
                  const isCashIn = Number(entry.amount_in) > 0;

                  return (
                    <View key={entry.id} style={[styles.entryItem, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                      <View style={styles.entryLeft}>
                        <View
                          style={[
                            styles.cashbookDot,
                            isCashIn ? styles.cashInDot : styles.cashOutDot,
                          ]}
                        />

                        <View style={styles.entryTextBox}>
                          <Text style={[styles.entryTitle, { color: theme.textPrimary }]}>
                            {formatEntryType(entry.entry_type)}
                          </Text>

                          <Text style={[styles.entryDescription, { color: theme.textSecondary }]}>
                            {entry.description}
                          </Text>

                          <Text style={[styles.entryDate, { color: theme.textMuted }]}>
                            {new Date(entry.entry_at).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                        styles.cashbookAmount,
                          isCashIn
                            ? { color: theme.success, backgroundColor: theme.successSoft }
                            : { color: theme.danger, backgroundColor: theme.dangerSoft },
                        ]}
                      >
                        {isCashIn ? "+" : "-"} Rs{" "}
                        {isCashIn ? entry.amount_in : entry.amount_out}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </AppCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F6FA",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  wrapper: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    gap: 16,
  },
  headerCard: {
    borderColor: "#CBD5E1",
    borderRadius: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryBox: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D8E0EA",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 6,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
  },
  summaryHint: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 16,
  },
  sectionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1D4ED8",
    backgroundColor: "#EFF6FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },
  closeInfoBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D8E0EA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  closeInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  closeInfoLabel: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "800",
  },
  closeInfoValue: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
  },
  closeButton: {
    marginTop: 4,
    backgroundColor: "#0F766E",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  categoryChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  categoryChipActive: {
    borderWidth: 2,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },
  categoryChipTextActive: {
  },
  expenseButton: {
    marginTop: 4,
    backgroundColor: "#B91C1C",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
  successText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
  entryList: {
    gap: 10,
  },
  entryItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E0EA",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  entryLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  entryTextBox: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 4,
  },
  entryDescription: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
    lineHeight: 19,
  },
  entryDate: {
    fontSize: 12,
    color: "#94A3B8",
  },
  expenseDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#DC2626",
    marginTop: 5,
  },
  cashbookDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
  },
  cashInDot: {
    backgroundColor: "#16A34A",
  },
  cashOutDot: {
    backgroundColor: "#DC2626",
  },
  neutralDot: {
    backgroundColor: "#64748B",
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: "900",
    color: "#B91C1C",
    backgroundColor: "#FEF2F2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cashbookAmount: {
    fontSize: 15,
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cashInText: {
    color: "#15803D",
    backgroundColor: "#ECFDF5",
  },
  cashOutText: {
    color: "#B91C1C",
    backgroundColor: "#FEF2F2",
  },
  neutralText: {
    color: "#0F172A",
    backgroundColor: "#F1F5F9",
  },
  goodText: {
    color: "#15803D",
  },
  badText: {
    color: "#B91C1C",
  },
  mutedText: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 21,
  },
});
