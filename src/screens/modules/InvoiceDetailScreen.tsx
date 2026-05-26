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
      <SafeAreaView style={styles.screen}>
        <View style={styles.wrapper}>
          <AppCard>
            <Text style={styles.errorText}>
              {error || "Invoice not found."}
            </Text>
          </AppCard>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Invoice detail"
              title={invoice.invoice_no}
              subtitle={`${invoice.customer_name} · ${formatDate(
                invoice.created_at
              )}`}
            />

            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {(invoice.return_status ?? invoice.payment_status).toUpperCase()}
              </Text>
            </View>

            <AppButton
              title={printing ? "Opening..." : "Share / Print Invoice"}
              onPress={handlePrint}
              disabled={printing}
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
              />
            ) : null}

            {invoice.payment_status !== "void" ? (
              <AppButton
                title={voiding ? "Voiding..." : "Cancel / Void Invoice"}
                onPress={handleVoidInvoice}
                disabled={voiding}
              />
            ) : (
              <Text style={styles.errorText}>This invoice is voided.</Text>
            )}
          </AppCard>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {successMessage ? (
            <Text style={styles.successText}>{successMessage}</Text>
          ) : null}

          <AppCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text style={styles.bigText}>{invoice.customer_name}</Text>
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Items</Text>

            {invoice.lines.map((line, index) => (
              <View key={line.id} style={styles.itemBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>
                    {index + 1}. {line.product_name}
                  </Text>
                  <Text style={styles.moneyText}>
                    {formatMoney(line.line_total)}
                  </Text>
                </View>

                    <Text style={styles.mutedText}>
                  Qty {line.quantity}
                  {line.unit_price > 0
                    ? ` · Unit ${formatMoney(line.unit_price)}`
                    : ""}
                  {line.returned_quantity ? ` · Returned ${line.returned_quantity}` : ""}
                </Text>
              </View>
            ))}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Totals</Text>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Grand total</Text>
              <Text style={styles.value}>{formatMoney(invoice.grand_total)}</Text>
            </View>

            {invoice.returned_total ? (
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Returned total</Text>
                <Text style={styles.value}>
                  {formatMoney(invoice.returned_total)}
                </Text>
              </View>
            ) : null}

            {invoice.net_total !== undefined ? (
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Net total</Text>
                <Text style={styles.value}>{formatMoney(invoice.net_total)}</Text>
              </View>
            ) : null}

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Paid amount</Text>
              <Text style={styles.value}>{formatMoney(invoice.paid_amount)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Balance due</Text>
              <Text style={styles.balanceText}>
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
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  bigText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  itemBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 6,
    backgroundColor: "#ffffff",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  moneyText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#166534",
  },
  mutedText: {
    fontSize: 13,
    color: "#64748b",
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
  balanceText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#b45309",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: "#075985",
    fontWeight: "900",
    fontSize: 12,
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
// import React, { useEffect, useState } from "react";
// import { SafeAreaView, ScrollView, StyleSheet, Text, View, Alert, Platform } from "react-native";
// import { AppCard, LoadingState } from "../../components/ui";
// import { AppButton } from "../../components/AppButton";
// import { getInvoiceById } from "../../database/invoicesRepository";
// import type { InvoiceListItem } from "../../types/invoice";

// function formatMoney(value: number) {
//   return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
// }

// export function InvoiceDetailScreen({ route }: any) {
//   const { invoiceId } = route.params ?? {};
//   const [invoice, setInvoice] = useState<any | null>(null);
//   const [loading, setLoading] = useState(true);

//   async function load() {
//     try {
//       setLoading(true);
//       const inv = await getInvoiceById(invoiceId);
//       setInvoice(inv);
//     } catch (err) {
//       Alert.alert("Error", err instanceof Error ? err.message : String(err));
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => { load(); }, [invoiceId]);

//   async function shareInvoice() {
//     if (!invoice) return;

//     const html = `
//       <html>
//       <head><meta charset="utf-8"><title>Invoice ${invoice.invoice_no}</title></head>
//       <body>
//         <h1>Invoice ${invoice.invoice_no}</h1>
//         <p>${new Date(invoice.created_at).toLocaleString()}</p>
//         <p>Customer: ${invoice.customer_name ?? "Walk-in"}</p>
//         <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width:100%">
//           <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead>
//           <tbody>
//             ${((invoice.items || []) as any[]).map(i => `<tr><td>${i.product_name_snapshot}</td><td>${i.quantity}</td><td>${i.unit_price}</td><td>${i.line_total}</td></tr>`).join("")}
//           </tbody>
//         </table>
//         <h3>Grand total: ${invoice.grand_total}</h3>
//         <p>Paid: ${invoice.paid_amount} · Balance: ${invoice.balance_due} · Status: ${invoice.payment_status}</p>
//       </body>
//       </html>
//     `;

//     if (Platform.OS === "web") {
//       const win = window.open("", "_blank");
//       if (!win) {
//         Alert.alert("Error", "Unable to open print window.");
//         return;
//       }
//       win.document.write(html);
//       win.document.close();
//       win.focus();
//       win.print();
//       return;
//     }

//     // Mobile: try to use expo-print and expo-sharing if available
//     try {
//     // dynamic import so web doesn't fail
//     // @ts-ignore: optional dependency
//     const Print = await import("expo-print");
//       const result = await Print.printAsync({ html });

//       try {
//         // @ts-ignore: optional dependency
//         const Sharing = await import("expo-sharing");
//         if (result.uri && Sharing.isAvailableAsync) {
//           const available = await Sharing.isAvailableAsync();
//           if (available) {
//             await Sharing.shareAsync(result.uri);
//           }
//         }
//       } catch (shareErr) {
//         // sharing not available, ignore
//       }
//     } catch (err) {
//       Alert.alert("Share", "Sharing not available on this platform. (expo-print/expo-sharing not installed)");
//     }
//   }

//   if (loading) return <LoadingState message="Loading invoice..." />;
//   if (!invoice) return (
//     <SafeAreaView style={styles.screen}><View style={styles.wrapper}><Text>Invoice not found.</Text></View></SafeAreaView>
//   );

//   return (
//     <SafeAreaView style={styles.screen}>
//       <ScrollView contentContainerStyle={styles.scrollContent}>
//         <View style={styles.wrapper}>
//           <AppCard>
//             <Text style={styles.invoiceNo}>{invoice.invoice_no}</Text>
//             <Text style={styles.meta}>{new Date(invoice.created_at).toLocaleString()}</Text>
//             <Text style={styles.meta}>Customer: {invoice.customer_name ?? "Walk-in"}</Text>

//             <View style={{ marginTop: 12 }}>
//               {(invoice.items || []).map((it: any) => (
//                 <View key={it.id} style={styles.itemRow}>
//                   <Text style={styles.itemName}>{it.product_name_snapshot}</Text>
//                   <Text style={styles.itemMeta}>{it.quantity} × {formatMoney(it.unit_price)} = {formatMoney(it.line_total)}</Text>
//                 </View>
//               ))}
//             </View>

//             <View style={styles.totals}>
//               <Text>Grand total: {formatMoney(invoice.grand_total)}</Text>
//               <Text>Paid: {formatMoney(invoice.paid_amount)}</Text>
//               <Text>Balance: {formatMoney(invoice.balance_due)}</Text>
//               <Text>Status: {invoice.payment_status}</Text>
//             </View>

//             <AppButton title="Share Invoice" onPress={shareInvoice} />
//           </AppCard>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   screen: { flex: 1, backgroundColor: "#F8FAFC" },
//   scrollContent: { padding: 16 },
//   wrapper: { width: "100%", maxWidth: 900, alignSelf: "center" },
//   invoiceNo: { fontSize: 20, fontWeight: "900" },
//   meta: { color: "#64748B", marginTop: 4 },
//   itemRow: { marginTop: 8, padding: 8, backgroundColor: "#fff", borderRadius: 8 },
//   itemName: { fontWeight: "800" },
//   itemMeta: { color: "#64748B" },
//   totals: { marginTop: 12 }
// });

// export default InvoiceDetailScreen;
