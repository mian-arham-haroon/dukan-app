import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "../../components/AppButton";
import { Alert } from "react-native";
import {
  AppCard,
  AppHeader,
  EmptyState,
  LoadingState,
} from "../../components/ui";
import { getReportsSummary } from "../../database/reportsRepository";
import { repairCustomerBalancesFromInvoices } from "../../database/udhaarRepository";
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

export function ReportsScreen() {
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

  return (
    <SafeAreaView style={styles.screen}>
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

            <AppButton title="Refresh reports" onPress={loadReports} />
          </AppCard>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.grid}>
            <MetricCard
              title={rangeMetricTitle("sales")}
              value={formatMoney(summary.todaySales)}
              subtitle={`Total invoices created ${selectedRangeLabel}`}
            />

            <MetricCard
              title={rangeMetricTitle("paid")}
              value={formatMoney(summary.todayPaid)}
              subtitle={`Paid amount from ${selectedRangeLabel} invoices`}
            />

            <MetricCard
              title={rangeMetricTitle("cash in")}
              value={formatMoney(summary.todayCashIn)}
              subtitle={`Cashbook money received ${selectedRangeLabel}`}
            />

            <MetricCard
              title={rangeMetricTitle("cash out")}
              value={formatMoney(summary.todayCashOut)}
              subtitle={`Expenses / cash out ${selectedRangeLabel}`}
            />

            <MetricCard
              title="Expected cash"
              value={formatMoney(summary.todayExpectedCash)}
              subtitle={`Cash in minus cash out for ${selectedRangeLabel}`}
            />

            <MetricCard
              title="Total udhaar"
              value={formatMoney(summary.totalUdhaar)}
              subtitle="Current customer receivable balance"
            />

            <MetricCard
              title="Stock value"
              value={formatMoney(summary.totalStockValue)}
              subtitle="Cost value of current stock"
            />

            <MetricCard
              title="Low stock"
              value={`${summary.lowStockCount}`}
              subtitle="Products at or below alert level"
            />
          </View>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Business counts</Text>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Products</Text>
              <Text style={styles.value}>{summary.productCount}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Customers</Text>
              <Text style={styles.value}>{summary.customerCount}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Invoices</Text>
              <Text style={styles.value}>{summary.invoiceCount}</Text>
            </View>
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Reconciliation</Text>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Opening balance total</Text>
              <Text style={styles.value}>{formatMoney(summary.openingBalanceTotal)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>All-time invoice unpaid total</Text>
              <Text style={styles.value}>{formatMoney(summary.invoiceUnpaidTotal)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Expected customer balance</Text>
              <Text style={styles.value}>{formatMoney(summary.expectedCustomerBalance)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Customer balance total</Text>
              <Text style={styles.value}>{formatMoney(summary.customerBalanceTotal)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Difference</Text>
              <Text style={styles.value}>{formatMoney(summary.udhaarDifference)}</Text>
            </View>

            {summary.udhaarDifference !== 0 ? (
              <Text style={styles.warningText}>
                Udhaar mismatch found. Customer balances and invoice balances are not equal.
              </Text>
            ) : null}

            <View style={{ marginTop: 8 }}>
              <AppButton
                title="Repair Customer Balances"
                variant="secondary"
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
            <Text style={styles.sectionTitle}>Recent invoices</Text>

            {summary.recentInvoices.length === 0 ? (
              <Text style={styles.mutedText}>No invoices yet.</Text>
            ) : (
              summary.recentInvoices.map((invoice) => (
                <View key={invoice.id} style={styles.listItem}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>{invoice.invoice_no}</Text>
                    <Text style={styles.moneyText}>
                      {formatMoney(invoice.grand_total)}
                    </Text>
                  </View>

                  <Text style={styles.itemText}>{invoice.customer_name}</Text>
                  <Text style={styles.itemText}>{invoice.item_summary}</Text>
                  <Text style={styles.itemText}>
                    {(invoice.return_status ?? invoice.payment_status).toUpperCase()} · Paid{" "}
                    {formatMoney(invoice.paid_amount)} · Balance{" "}
                    {formatMoney(invoice.balance_due)}
                  </Text>
                  {invoice.returned_total ? (
                    <Text style={styles.itemText}>
                      Returned {formatMoney(invoice.returned_total)} · Net {formatMoney(invoice.net_total ?? 0)}
                    </Text>
                  ) : null}
                  <Text style={styles.dateText}>{formatDate(invoice.created_at)}</Text>
                </View>
              ))
            )}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Low stock products</Text>

            {summary.lowStockProducts.length === 0 ? (
              <Text style={styles.mutedText}>No low stock products.</Text>
            ) : (
              summary.lowStockProducts.map((product) => (
                <View key={product.id} style={styles.listItem}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>{product.name}</Text>
                    <Text style={styles.warningText}>
                      Stock {product.stock_quantity}
                    </Text>
                  </View>

                  <Text style={styles.itemText}>
                    Alert level: {product.low_stock_alert}
                  </Text>
                  <Text style={styles.itemText}>
                    Cost {formatMoney(product.cost_price)} · Selling{" "}
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

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
};

function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <AppCard style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </AppCard>
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
    gap: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 190,
    gap: 6,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  metricSubtitle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  sectionCard: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  rangeButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rangeButton: {
    flexShrink: 1,
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
    fontWeight: "800",
    color: "#0f172a",
  },
  listItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: "#ffffff",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
  },
  itemText: {
    fontSize: 13,
    color: "#475569",
  },
  mutedText: {
    fontSize: 14,
    color: "#64748b",
  },
  moneyText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#166534",
  },
  warningText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#b45309",
  },
  dateText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
});