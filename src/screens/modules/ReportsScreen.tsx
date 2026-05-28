import React, { useEffect, useState } from "react";
import {
  Alert,
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
  EmptyState,
  LoadingState,
} from "../../components/ui";
import { getReportsSummary } from "../../database/reportsRepository";
import { repairCustomerBalancesFromInvoices } from "../../database/udhaarRepository";
import type { AppTheme } from "../../theme/theme";
import { useAppTheme } from "../../theme/useAppTheme";
import type { ReportRange, ReportsSummary } from "../../types/report";

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

  if (normalizedStatus === "VOID" || normalizedStatus === "UNPAID") {
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

export function ReportsScreen() {
  const { theme } = useAppTheme();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRange, setSelectedRange] = useState<ReportRange>("today");

  const selectedRangeLabel =
    selectedRange === "today"
      ? "today"
      : selectedRange === "yesterday"
      ? "yesterday"
      : selectedRange === "month"
      ? "this month"
      : "all time";

  function rangeMetricTitle(title: string) {
    if (selectedRange === "today") {
      return `Today ${title}`;
    }

    if (selectedRange === "yesterday") {
      return `Yesterday ${title}`;
    }

    if (selectedRange === "month") {
      return `This month ${title}`;
    }

    return `All time ${title}`;
  }

  async function loadReports() {
    try {
      setLoading(true);
      setError("");

      const result = await getReportsSummary(selectedRange);
      setSummary(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load reports."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [selectedRange]);

  if (loading) {
    return <LoadingState message="Loading reports..." />;
  }

  if (!summary) {
    return (
      <EmptyState
        title="No report data"
        message="Create products, customers, and invoices first."
      />
    );
  }

  const differenceIsHealthy = summary.udhaarDifference === 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Business reports"
              title="Reports"
              subtitle={`Check sales, cash, udhaar, stock value, low stock, and recent invoices for ${selectedRangeLabel}.`}
            />

            <View style={styles.rangeButtonRow}>
              <AppButton
                title="Today"
                variant={selectedRange === "today" ? "primary" : "secondary"}
                onPress={() => setSelectedRange("today")}
                style={styles.rangeButton}
              />
              <AppButton
                title="Yesterday"
                variant={selectedRange === "yesterday" ? "primary" : "secondary"}
                onPress={() => setSelectedRange("yesterday")}
                style={styles.rangeButton}
              />
              <AppButton
                title="This month"
                variant={selectedRange === "month" ? "primary" : "secondary"}
                onPress={() => setSelectedRange("month")}
                style={styles.rangeButton}
              />
              <AppButton
                title="All time"
                variant={selectedRange === "all" ? "primary" : "secondary"}
                onPress={() => setSelectedRange("all")}
                style={styles.rangeButton}
              />
            </View>

            <AppButton title="Refresh reports" onPress={loadReports} fullWidth />
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

          <View style={styles.grid}>
            <MetricCard
              title={rangeMetricTitle("sales")}
              value={formatMoney(summary.todaySales)}
              subtitle={`Total invoices created ${selectedRangeLabel}`}
              tone="primary"
            />
            <MetricCard
              title={rangeMetricTitle("paid")}
              value={formatMoney(summary.todayPaid)}
              subtitle={`Paid amount from ${selectedRangeLabel} invoices`}
              tone="success"
            />
            <MetricCard
              title={rangeMetricTitle("cash in")}
              value={formatMoney(summary.todayCashIn)}
              subtitle={`Cashbook money received ${selectedRangeLabel}`}
              tone="success"
            />
            <MetricCard
              title={rangeMetricTitle("cash out")}
              value={formatMoney(summary.todayCashOut)}
              subtitle={`Expenses / cash out ${selectedRangeLabel}`}
              tone="danger"
            />
            <MetricCard
              title="Expected cash"
              value={formatMoney(summary.todayExpectedCash)}
              subtitle={`Cash in minus cash out for ${selectedRangeLabel}`}
              tone="primary"
            />
            <MetricCard
              title="Total udhaar"
              value={formatMoney(summary.totalUdhaar)}
              subtitle="Current customer receivable balance"
              tone="warning"
            />
            <MetricCard
              title="Stock value"
              value={formatMoney(summary.totalStockValue)}
              subtitle="Cost value of current stock"
              tone="primary"
            />
            <MetricCard
              title="Low stock"
              value={`${summary.lowStockCount}`}
              subtitle="Products at or below alert level"
              tone={summary.lowStockCount > 0 ? "warning" : "success"}
            />
          </View>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Business counts
            </Text>

            <InfoRow label="Products" value={`${summary.productCount}`} />
            <InfoRow label="Customers" value={`${summary.customerCount}`} />
            <InfoRow label="Invoices" value={`${summary.invoiceCount}`} />
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Reconciliation
            </Text>

            <InfoRow
              label="Opening balance total"
              value={formatMoney(summary.openingBalanceTotal)}
            />
            <InfoRow
              label="All-time invoice unpaid total"
              value={formatMoney(summary.invoiceUnpaidTotal)}
            />
            <InfoRow
              label="Expected customer balance"
              value={formatMoney(summary.expectedCustomerBalance)}
            />
            <InfoRow
              label="Customer balance total"
              value={formatMoney(summary.customerBalanceTotal)}
            />

            <View
              style={[
                styles.rowBetween,
                styles.infoRow,
                {
                  backgroundColor: differenceIsHealthy
                    ? theme.successSoft
                    : theme.dangerSoft,
                  borderColor: differenceIsHealthy ? theme.success : theme.danger,
                },
              ]}
            >
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Difference
              </Text>
              <Text
                style={[
                  styles.reconciliationValue,
                  {
                    color: differenceIsHealthy ? theme.success : theme.danger,
                  },
                ]}
              >
                {formatMoney(summary.udhaarDifference)}
              </Text>
            </View>

            {summary.udhaarDifference !== 0 ? (
              <Text
                style={[
                  styles.warningBanner,
                  {
                    color: theme.warning,
                    backgroundColor: theme.warningSoft,
                    borderColor: theme.warning,
                  },
                ]}
              >
                Udhaar mismatch found. Customer balances and invoice balances are not equal.
              </Text>
            ) : null}

            <View style={styles.repairButtonWrap}>
              <AppButton
                title="Repair Customer Balances"
                variant="secondary"
                fullWidth
                onPress={async () => {
                  try {
                    setLoading(true);
                    const repaired = await repairCustomerBalancesFromInvoices();
                    await loadReports();
                    Alert.alert(
                      "Success",
                      "Customer balances repaired from invoice balances."
                    );
                  } catch (err) {
                    Alert.alert(
                      "Error",
                      err instanceof Error ? err.message : "Repair failed"
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </View>
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Recent invoices
            </Text>

            {summary.recentInvoices.length === 0 ? (
              <Text style={[styles.mutedText, { color: theme.textMuted }]}>
                No invoices yet.
              </Text>
            ) : (
              summary.recentInvoices.map((invoice) => {
                const status = (
                  invoice.return_status ?? invoice.payment_status
                ).toUpperCase();
                const statusColors = getStatusColors(status, theme);

                return (
                  <View
                    key={invoice.id}
                    style={[
                      styles.listItem,
                      {
                        backgroundColor: theme.cardMuted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                        {invoice.invoice_no}
                      </Text>
                      <Text
                        style={[
                          styles.moneyText,
                          {
                            color: theme.success,
                            backgroundColor: theme.successSoft,
                          },
                        ]}
                      >
                        {formatMoney(invoice.grand_total)}
                      </Text>
                    </View>

                    <Text style={[styles.itemText, { color: theme.textSecondary }]}>
                      {invoice.customer_name}
                    </Text>
                    <Text style={[styles.itemText, { color: theme.textSecondary }]}>
                      {invoice.item_summary}
                    </Text>

                    <View style={styles.invoiceMetaRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: statusColors.backgroundColor,
                            borderColor: statusColors.borderColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: statusColors.color },
                          ]}
                        >
                          {status}
                        </Text>
                      </View>
                      <Text style={[styles.itemText, { color: theme.textSecondary }]}>
                        Paid {formatMoney(invoice.paid_amount)} - Balance{" "}
                        {formatMoney(invoice.balance_due)}
                      </Text>
                    </View>

                    {invoice.returned_total ? (
                      <Text style={[styles.itemText, { color: theme.textSecondary }]}>
                        Returned {formatMoney(invoice.returned_total)} - Net{" "}
                        {formatMoney(invoice.net_total ?? 0)}
                      </Text>
                    ) : null}
                    <Text style={[styles.dateText, { color: theme.textMuted }]}>
                      {formatDate(invoice.created_at)}
                    </Text>
                  </View>
                );
              })
            )}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Low stock products
            </Text>

            {summary.lowStockProducts.length === 0 ? (
              <Text style={[styles.mutedText, { color: theme.textMuted }]}>
                No low stock products.
              </Text>
            ) : (
              summary.lowStockProducts.map((product) => (
                <View
                  key={product.id}
                  style={[
                    styles.listItem,
                    {
                      backgroundColor: theme.cardMuted,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                      {product.name}
                    </Text>
                    <Text
                      style={[
                        styles.warningText,
                        {
                          color: theme.warning,
                          backgroundColor: theme.warningSoft,
                        },
                      ]}
                    >
                      Stock {product.stock_quantity}
                    </Text>
                  </View>

                  <Text style={[styles.itemText, { color: theme.textSecondary }]}>
                    Alert level: {product.low_stock_alert}
                  </Text>
                  <Text style={[styles.itemText, { color: theme.textSecondary }]}>
                    Cost {formatMoney(product.cost_price)} - Selling{" "}
                    {formatMoney(product.selling_price)}
                  </Text>
                </View>
              ))
            )}
          </AppCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.rowBetween,
        styles.infoRow,
        { backgroundColor: theme.cardMuted, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.textPrimary }]}>{value}</Text>
    </View>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  tone?: "primary" | "success" | "warning" | "danger";
};

function MetricCard({
  title,
  value,
  subtitle,
  tone = "primary",
}: MetricCardProps) {
  const { theme } = useAppTheme();
  const toneColor =
    tone === "success"
      ? theme.success
      : tone === "warning"
      ? theme.warning
      : tone === "danger"
      ? theme.danger
      : theme.primary;
  const toneBackground =
    tone === "success"
      ? theme.successSoft
      : tone === "warning"
      ? theme.warningSoft
      : tone === "danger"
      ? theme.dangerSoft
      : theme.primarySoft;

  return (
    <AppCard
      variant="muted"
      style={[
        styles.metricCard,
        { backgroundColor: toneBackground, borderColor: toneColor },
      ]}
    >
      <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>
        {title}
      </Text>
      <Text style={[styles.metricValue, { color: toneColor }]}>{value}</Text>
      <Text style={[styles.metricSubtitle, { color: theme.textMuted }]}>
        {subtitle}
      </Text>
    </AppCard>
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 190,
    gap: 6,
    borderRadius: 16,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "900",
  },
  metricSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    gap: 12,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  rangeButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rangeButton: {
    flexGrow: 1,
    minWidth: 132,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  infoRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  value: {
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  reconciliationValue: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  repairButtonWrap: {
    marginTop: 8,
  },
  listItem: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  itemText: {
    fontSize: 13,
    lineHeight: 19,
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 21,
  },
  moneyText: {
    fontSize: 14,
    fontWeight: "900",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  warningText: {
    fontSize: 14,
    fontWeight: "900",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  warningBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  invoiceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  dateText: {
    fontSize: 12,
  },
  errorText: {
    fontWeight: "800",
    lineHeight: 19,
  },
});
