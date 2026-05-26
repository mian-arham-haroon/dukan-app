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
            <Text style={[styles.errorText, { color: theme.danger }]}>{error || "Invoice not found."}</Text>
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
              subtitle={`${preview.customerName} · Balance ${formatMoney(
                preview.balanceDue
              )}`}
            />
          </AppCard>

          {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
          {successMessage ? (
            <Text style={[styles.successText, { color: theme.success }]}>{successMessage}</Text>
          ) : null}

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Return items</Text>

            {preview.lines.map((line) => {
              const key = line.productId ?? line.productName;

              return (
                <View key={key} style={[styles.itemBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{line.productName}</Text>

                  <Text style={[styles.mutedText, { color: theme.textSecondary }]}>
                    Sold: {line.soldQuantity} · Already returned:{" "}
                    {line.alreadyReturnedQuantity} · Max return:{" "}
                    {line.maxReturnQuantity}
                  </Text>

                  <Text style={[styles.mutedText, { color: theme.textSecondary }]}>
                    Unit price: {formatMoney(line.unitPrice)}
                  </Text>

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
                  />
                </View>
              );
            })}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Return summary</Text>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Return total</Text>
              <Text style={[styles.value, { color: theme.textPrimary }]}>{formatMoney(totals.returnTotal)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Udhaar balance reduced</Text>
              <Text style={[styles.value, { color: theme.textPrimary }]}>
                {formatMoney(totals.balanceReduced)}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Cash refund</Text>
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
            />

            <AppButton
              title={saving ? "Saving return..." : "Save Return / Refund"}
              onPress={handleSaveReturn}
              disabled={saving}
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
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  wrapper: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    gap: 14,
  },
  headerCard: {
    gap: 12,
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  itemBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    backgroundColor: "#ffffff",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
  },
  mutedText: {
    fontSize: 13,
    color: "#64748b",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: "#64748b",
  },
  value: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  refundText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#b45309",
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  successText: {
    color: "#166534",
    fontWeight: "700",
  },
});
