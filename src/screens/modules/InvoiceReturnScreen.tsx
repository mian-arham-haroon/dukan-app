import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton } from "../../components/AppButton";
import { AppCard, AppHeader, AppInput, LoadingState } from "../../components/ui";
import {
  createInvoiceReturn,
  getInvoiceReturnPreview,
} from "../../database/returnsRepository";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import type { InvoiceReturnPreview } from "../../types/return";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = NativeStackScreenProps<RootStackParamList, "InvoiceReturn">;

function formatMoney(value: number): string {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function parseNumber(value: string): number {
  const parsed = Number(value.trim() || 0);
  return Number.isNaN(parsed) ? -1 : parsed;
}

function confirmReturnAction(): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      (globalThis as any).confirm(
        "Confirm return/refund? This will update stock, customer balance, and payment/cashbook records."
      )
    );
  }

  return new Promise((resolve) => {
    Alert.alert(
      "Confirm return/refund",
      "This will update stock, customer balance, and payment/cashbook records.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Confirm",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ]
    );
  });
}

export function InvoiceReturnScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const { invoiceId, localId } = route.params;

  const [preview, setPreview] = useState<InvoiceReturnPreview | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadPreview() {
    try {
      setLoading(true);
      setError("");

      const result = await getInvoiceReturnPreview(invoiceId, localId);
      setPreview(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load return preview."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, [invoiceId]);

  const totals = useMemo(() => {
    if (!preview) {
      return {
        returnTotal: 0,
        balanceReduced: 0,
        cashRefund: 0,
      };
    }

    let returnTotal = 0;

    for (const line of preview.lines) {
      const key = line.productId ?? line.productName;
      const qty = parseNumber(quantities[key] ?? "0");

      if (qty > 0) {
        returnTotal += qty * line.unitPrice;
      }
    }

    const balanceReduced = Math.min(returnTotal, preview.balanceDue);
    const cashRefund = Math.max(0, returnTotal - preview.balanceDue);

    return {
      returnTotal,
      balanceReduced,
      cashRefund,
    };
  }, [preview, quantities]);

  async function handleSaveReturn() {
    if (!preview || saving) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    const lines = preview.lines
      .map((line) => {
        const key = line.productId ?? line.productName;
        return {
          productId: line.productId,
          productName: line.productName,
          quantity: parseNumber(quantities[key] ?? "0"),
          unitPrice: line.unitPrice,
        };
      })
      .filter((line) => line.quantity > 0);

    if (lines.length === 0) {
      setError("Enter at least one return quantity.");
      setSaving(false);
      return;
    }

    const confirmed = await confirmReturnAction();
    if (!confirmed) {
      setSaving(false);
      return;
    }

    try {
      const result = await createInvoiceReturn({
        invoiceId: preview.invoiceId,
        lines,
        note,
      });

      setSuccessMessage(result.message);
      await loadPreview();

      setTimeout(() => {
        navigation.goBack();
      }, 700);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save return."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading return screen..." />;
  }

  if (!preview) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={styles.wrapper}>
          <AppCard>
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {error || "Invoice not found."}
            </Text>
          </AppCard>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Return / Refund"
              title={preview.invoiceNo}
              subtitle={preview.customerName}
            />

            <View style={styles.headerStats}>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: theme.cardMuted, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Balance due
                </Text>
                <Text style={[styles.statValue, { color: theme.warning }]}>
                  {formatMoney(preview.balanceDue)}
                </Text>
              </View>

              <View
                style={[
                  styles.statBox,
                  { backgroundColor: theme.cardMuted, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Paid amount
                </Text>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {formatMoney(preview.paidAmount)}
                </Text>
              </View>
            </View>
          </AppCard>

          {error ? (
            <View
              style={[
                styles.messageBox,
                {
                  backgroundColor: theme.dangerSoft,
                  borderColor: theme.danger,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </Text>
            </View>
          ) : null}
          {successMessage ? (
            <View
              style={[
                styles.messageBox,
                {
                  backgroundColor: theme.successSoft,
                  borderColor: theme.success,
                },
              ]}
            >
              <Text style={[styles.successText, { color: theme.success }]}>
                {successMessage}
              </Text>
            </View>
          ) : null}

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Return items
            </Text>

            {preview.lines.map((line) => {
              const key = line.productId ?? line.productName;

              return (
                <View
                  key={key}
                  style={[
                    styles.itemBox,
                    {
                      backgroundColor: theme.cardMuted,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                      {line.productName}
                    </Text>
                    <Text style={[styles.unitPrice, { color: theme.textSecondary }]}>
                      {formatMoney(line.unitPrice)}
                    </Text>
                  </View>

                  <View style={styles.qtyGrid}>
                    <View
                      style={[
                        styles.qtyBox,
                        {
                          backgroundColor: theme.surfaceMuted,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.qtyLabel, { color: theme.textSecondary }]}>
                        Sold
                      </Text>
                      <Text style={[styles.qtyValue, { color: theme.textPrimary }]}>
                        {line.soldQuantity}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.qtyBox,
                        {
                          backgroundColor: theme.surfaceMuted,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.qtyLabel, { color: theme.textSecondary }]}>
                        Returned
                      </Text>
                      <Text style={[styles.qtyValue, { color: theme.textPrimary }]}>
                        {line.alreadyReturnedQuantity}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.qtyBox,
                        {
                          backgroundColor: theme.primarySoft,
                          borderColor: theme.primary,
                        },
                      ]}
                    >
                      <Text style={[styles.qtyLabel, { color: theme.textSecondary }]}>
                        Max return
                      </Text>
                      <Text style={[styles.qtyValue, { color: theme.primary }]}>
                        {line.maxReturnQuantity}
                      </Text>
                    </View>
                  </View>

                  <AppInput
                    label="Return quantity"
                    value={quantities[key] ?? ""}
                    onChangeText={(value) =>
                      setQuantities((previous) => ({
                        ...previous,
                        [key]: value,
                      }))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    containerStyle={styles.inputContainer}
                  />
                </View>
              );
            })}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Return summary
            </Text>

            <View
              style={[
                styles.summaryRow,
                styles.summaryRowEmphasis,
                {
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.primary,
                },
              ]}
            >
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Return total
              </Text>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>
                {formatMoney(totals.returnTotal)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryRow,
                { backgroundColor: theme.successSoft, borderColor: theme.success },
              ]}
            >
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Udhaar balance reduced
              </Text>
              <Text style={[styles.value, { color: theme.success }]}>
                {formatMoney(totals.balanceReduced)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryRow,
                { backgroundColor: theme.warningSoft, borderColor: theme.warning },
              ]}
            >
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Cash refund
              </Text>
              <Text style={[styles.refundText, { color: theme.warning }]}>
                {formatMoney(totals.cashRefund)}
              </Text>
            </View>

            <AppInput
              label="Note"
              value={note}
              onChangeText={setNote}
              placeholder="Optional return note"
              multiline
              containerStyle={styles.noteInputContainer}
            />

            <AppButton
              title={saving ? "Saving return..." : "Save Return / Refund"}
              onPress={handleSaveReturn}
              disabled={saving}
              fullWidth
            />
          </AppCard>
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
    gap: 14,
    borderRadius: 20,
  },
  sectionCard: {
    gap: 12,
    borderRadius: 20,
  },
  headerStats: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  statBox: {
    flex: 1,
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  itemBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  unitPrice: {
    fontSize: 13,
    fontWeight: "900",
    paddingTop: 2,
  },
  qtyGrid: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  qtyBox: {
    flex: 1,
    minWidth: 92,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 3,
  },
  qtyLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  inputContainer: {
    marginBottom: 0,
  },
  noteInputContainer: {
    marginBottom: 4,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  value: {
    fontSize: 15,
    fontWeight: "900",
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: "900",
  },
  refundText: {
    fontSize: 15,
    fontWeight: "900",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  summaryRowEmphasis: {
    paddingVertical: 16,
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontWeight: "800",
    lineHeight: 19,
  },
  successText: {
    fontWeight: "800",
    lineHeight: 19,
  },
});
