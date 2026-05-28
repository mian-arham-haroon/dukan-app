import React, { useEffect, useState } from "react";
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
import { AppCard, AppHeader, LoadingState } from "../../components/ui";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import {
  getInvoicePrintData,
  printInvoice,
} from "../../services/invoicePrintService";
import { voidInvoice } from "../../database/invoiceVoidRepository";
import type { AppTheme } from "../../theme/theme";
import { useAppTheme } from "../../theme/useAppTheme";
import type { InvoicePrintData } from "../../types/invoicePrint";

type Props = NativeStackScreenProps<RootStackParamList, "InvoiceDetail">;

function formatMoney(value: number): string {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

function getDisplayStatus(invoice: InvoicePrintData): string {
  if (invoice.payment_status === "void") {
    return "VOID";
  }

  return (invoice.return_status ?? invoice.payment_status).toUpperCase();
}

function getStatusColors(status: string, theme: AppTheme) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === "PAID" || normalizedStatus === "FULLY RETURNED") {
    return {
      backgroundColor: theme.successSoft,
      borderColor: theme.success,
      color: theme.success,
    };
  }

  if (normalizedStatus === "PARTIAL" || normalizedStatus === "PARTIAL RETURNED") {
    return {
      backgroundColor: theme.warningSoft,
      borderColor: theme.warning,
      color: theme.warning,
    };
  }

  if (normalizedStatus === "VOID") {
    return {
      backgroundColor: theme.dangerSoft,
      borderColor: theme.danger,
      color: theme.danger,
    };
  }

  if (normalizedStatus === "UNPAID") {
    return {
      backgroundColor: theme.dangerSoft,
      borderColor: theme.danger,
      color: theme.danger,
    };
  }

  return {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary,
    color: theme.primary,
  };
}

function confirmVoidInvoice(): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      (globalThis as any).confirm(
        "Void this invoice? This will restore stock, reduce udhaar, and add cash reversal if needed."
      )
    );
  }

  return new Promise((resolve) => {
    Alert.alert(
      "Void invoice?",
      "This will restore stock, reduce udhaar, and add cash reversal if needed.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Void Invoice",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ]
    );
  });
}

export function InvoiceDetailScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const { invoiceId } = route.params;

  const [invoice, setInvoice] = useState<InvoicePrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadInvoice() {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const result = await getInvoicePrintData(invoiceId);
      setInvoice(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load invoice."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  async function handlePrint() {
    if (!invoice) {
      return;
    }

    try {
      setPrinting(true);
      setError("");
      setSuccessMessage("");

      await printInvoice(invoice);
      setSuccessMessage("Invoice print window opened.");
    } catch (printError) {
      setError(
        printError instanceof Error
          ? printError.message
          : "Failed to print invoice."
      );
    } finally {
      setPrinting(false);
    }
  }

  async function handleVoidInvoice() {
    if (!invoice || voiding) {
      return;
    }

    const confirmed = await confirmVoidInvoice();

    if (!confirmed) {
      return;
    }

    try {
      setVoiding(true);
      setError("");
      setSuccessMessage("");

      const result = await voidInvoice(invoice.id);

      setSuccessMessage(result.message);
      await loadInvoice();
    } catch (voidError) {
      setError(
        voidError instanceof Error
          ? voidError.message
          : "Failed to void invoice."
      );
    } finally {
      setVoiding(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading invoice..." />;
  }

  if (!invoice) {
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

  const displayStatus = getDisplayStatus(invoice);
  const statusColors = getStatusColors(displayStatus, theme);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <View style={styles.headerTop}>
              <AppHeader
                eyebrow="Invoice detail"
                title={invoice.invoice_no}
                subtitle={formatDate(invoice.created_at)}
              />

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: statusColors.backgroundColor,
                    borderColor: statusColors.borderColor,
                  },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColors.color }]}>
                  {displayStatus}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.customerPanel,
                { backgroundColor: theme.cardMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
                Customer
              </Text>
              <Text style={[styles.customerName, { color: theme.textPrimary }]}>
                {invoice.customer_name}
              </Text>
            </View>

            <AppButton
              title={printing ? "Opening..." : "Share / Print Invoice"}
              onPress={handlePrint}
              disabled={printing}
              variant="secondary"
              fullWidth
            />

            {invoice.payment_status !== "void" ? (
              <AppButton
                title="Return / Refund"
                onPress={() =>
                  navigation.navigate("InvoiceReturn", {
                    invoiceId: invoice.id,
                    localId: invoice.local_id,
                    invoiceNo: invoice.invoice_no,
                  })
                }
                fullWidth
              />
            ) : null}

            {invoice.payment_status !== "void" ? (
              <AppButton
                title={voiding ? "Voiding..." : "Cancel / Void Invoice"}
                onPress={handleVoidInvoice}
                disabled={voiding}
                variant="danger"
                fullWidth
                style={styles.dangerButton}
              />
            ) : (
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
                  This invoice is voided.
                </Text>
              </View>
            )}
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
              Items
            </Text>

            {invoice.lines.map((line, index) => (
              <View
                key={line.id}
                style={[
                  styles.itemBox,
                  { backgroundColor: theme.cardMuted, borderColor: theme.border },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                    {line.product_name}
                  </Text>
                  <Text style={[styles.moneyText, { color: theme.success }]}>
                    {formatMoney(line.line_total)}
                  </Text>
                </View>

                <View style={styles.itemMetaRow}>
                  <Text
                    style={[
                      styles.itemIndex,
                      {
                        backgroundColor: theme.surfaceMuted,
                        color: theme.textSecondary,
                      },
                    ]}
                  >
                    #{index + 1}
                  </Text>
                  <Text style={[styles.mutedText, { color: theme.textSecondary }]}>
                    Qty {line.quantity}
                    {line.unit_price > 0
                      ? ` - Unit ${formatMoney(line.unit_price)}`
                      : ""}
                    {line.returned_quantity
                      ? ` - Returned ${line.returned_quantity}`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Totals
            </Text>

            <View
              style={[
                styles.totalRow,
                styles.totalRowEmphasis,
                {
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.primary,
                },
              ]}
            >
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Grand total
              </Text>
              <Text style={[styles.totalValue, { color: theme.primary }]}>
                {formatMoney(invoice.grand_total)}
              </Text>
            </View>

            {invoice.returned_total ? (
              <View
                style={[
                  styles.totalRow,
                  { backgroundColor: theme.cardMuted, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Returned total
                </Text>
                <Text style={[styles.value, { color: theme.textPrimary }]}>
                  {formatMoney(invoice.returned_total)}
                </Text>
              </View>
            ) : null}

            {invoice.net_total !== undefined ? (
              <View
                style={[
                  styles.totalRow,
                  { backgroundColor: theme.cardMuted, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Net total
                </Text>
                <Text style={[styles.value, { color: theme.textPrimary }]}>
                  {formatMoney(invoice.net_total)}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.totalRow,
                { backgroundColor: theme.cardMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Paid amount
              </Text>
              <Text style={[styles.value, { color: theme.textPrimary }]}>
                {formatMoney(invoice.paid_amount)}
              </Text>
            </View>

            <View
              style={[
                styles.totalRow,
                styles.totalRowEmphasis,
                {
                  backgroundColor: theme.warningSoft,
                  borderColor: theme.warning,
                },
              ]}
            >
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Balance due
              </Text>
              <Text style={[styles.balanceText, { color: theme.warning }]}>
                {formatMoney(invoice.balance_due)}
              </Text>
            </View>
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
  headerTop: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  customerName: {
    fontSize: 17,
    fontWeight: "900",
  },
  customerPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  itemBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  moneyText: {
    fontSize: 14,
    fontWeight: "900",
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  itemIndex: {
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
  },
  mutedText: {
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
  },
  value: {
    fontSize: 15,
    fontWeight: "900",
  },
  balanceText: {
    fontSize: 17,
    fontWeight: "900",
  },
  totalValue: {
    fontSize: 17,
    fontWeight: "900",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  totalRowEmphasis: {
    paddingVertical: 16,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontWeight: "900",
    fontSize: 12,
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dangerButton: {
    minHeight: 56,
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
