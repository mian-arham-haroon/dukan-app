import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton } from "../../components/AppButton";
import { AppCard, AppInput, EmptyState, LoadingState, AppHeader } from "../../components/ui";
import { getProducts } from "../../database/productsRepository";
import { getCustomers } from "../../database/customersRepository";
import { createInvoice, getInvoices } from "../../database";
import type { Product } from "../../types/product";
import type { Customer } from "../../types/customer";
import type { InvoiceListItem, PaymentStatus } from "../../types/invoice";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = NativeStackScreenProps<RootStackParamList, "Invoices">;

type CartLine = {
  productId: string;
  productName: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
  lineTotal: number;
};

function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? -1 : parsed;
}

export function InvoicesScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [quantity, setQuantity] = useState("1");

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [partialPaidAmount, setPartialPaidAmount] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveInvoiceLockRef = useRef(false);

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedProductId) ?? null, [products, selectedProductId]);
  const parsedQuantity = parseNumber(quantity);

  const invoiceTotal = useMemo(() => cartLines.reduce((s, l) => s + l.lineTotal, 0), [cartLines]);

  const paidAmount = useMemo(() => {
    if (paymentStatus === "paid") return invoiceTotal;
    if (paymentStatus === "unpaid") return 0;
    return parseNumber(partialPaidAmount) || 0;
  }, [invoiceTotal, partialPaidAmount, paymentStatus]);

  const balanceDue = invoiceTotal - paidAmount;
  const totalInvoiceAmount = useMemo(() => invoices.reduce((s, i) => s + Number(i.grand_total || 0), 0), [invoices]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [prods, custs, invs] = await Promise.all([getProducts(), getCustomers(), getInvoices()]);
      setProducts(prods);
      setCustomers(custs);
      setInvoices(invs);
      if (!selectedProductId && prods.length > 0) setSelectedProductId(prods[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function handleAddItemToCart() {
    setError("");
    if (!selectedProduct) { setError("Select a product first."); return; }
    if (parsedQuantity <= 0) { setError("Quantity must be greater than 0."); return; }
    const existing = cartLines.find((c) => c.productId === selectedProduct.id);
    const nextQty = (existing?.quantity ?? 0) + parsedQuantity;
    if (nextQty > selectedProduct.stock_quantity) { setError(`Only ${selectedProduct.stock_quantity} stock available.`); return; }
    if (existing) {
      setCartLines((cur) => cur.map((l) => l.productId === existing.productId ? { ...l, quantity: nextQty, lineTotal: nextQty * l.unitPrice } : l));
    } else {
      setCartLines((cur) => [...cur, { productId: selectedProduct.id, productName: selectedProduct.name, unitPrice: selectedProduct.selling_price, availableStock: selectedProduct.stock_quantity, quantity: parsedQuantity, lineTotal: selectedProduct.selling_price * parsedQuantity }]);
    }
    setQuantity("1");
  }

  function handleRemoveCartLine(productId: string) { setCartLines((cur) => cur.filter((l) => l.productId !== productId)); }

  async function handleSaveInvoice() {
    if (saveInvoiceLockRef.current || saving) {
      return;
    }

    saveInvoiceLockRef.current = true;
    setSaving(true);
    setError("");

    try {
      if (cartLines.length === 0) {
        setError("Add at least one product to the invoice.");
        return;
      }

      if (paymentStatus === "partial" && paidAmount <= 0) {
        setError("Partial paid amount must be greater than 0.");
        return;
      }

      if (paidAmount > invoiceTotal) {
        setError("Paid amount cannot be greater than invoice total.");
        return;
      }

      if (balanceDue > 0 && !selectedCustomerId) {
        setError("Select a customer for partial or unpaid invoice.");
        return;
      }

      await createInvoice({
        customerId: selectedCustomerId,
        lines: cartLines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentStatus,
        paidAmount,
      } as any);

      setCartLines([]);
      setQuantity("1");
      setPaymentStatus("paid");
      setPartialPaidAmount("");
      setSelectedCustomerId(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
      saveInvoiceLockRef.current = false;
    }
  }

  if (loading) return <LoadingState message="Loading invoices..." />;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader eyebrow="Sales" title="Invoices" subtitle="Create multi-item invoices, reduce stock, collect cash, and update udhaar." />
            <View style={styles.summaryRow}>
              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Invoices</Text><Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{invoices.length}</Text><Text style={[styles.summaryHint, { color: theme.textMuted }]}>Created records</Text></View>
              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Sales total</Text><Text style={[styles.summaryValue, { color: theme.textPrimary }]}>Rs {totalInvoiceAmount}</Text><Text style={[styles.summaryHint, { color: theme.textMuted }]}>Invoice value</Text></View>
            </View>
          </AppCard>

          <AppCard style={styles.formCard}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Create invoice</Text>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Customer</Text>
            <View style={styles.optionGrid}>
              <Pressable onPress={() => setSelectedCustomerId(null)} style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }, selectedCustomerId === null && { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                <Text style={[styles.optionTitle, { color: selectedCustomerId === null ? theme.primary : theme.textPrimary }]}>Walk-in</Text>
                <Text style={[styles.optionMeta, { color: selectedCustomerId === null ? theme.textPrimary : theme.textSecondary }]}>Cash sale only</Text>
              </Pressable>
              {customers.map((c) => (
                <Pressable key={c.id} onPress={() => setSelectedCustomerId(c.id)} style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }, selectedCustomerId === c.id && { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                  <Text style={[styles.optionTitle, { color: selectedCustomerId === c.id ? theme.primary : theme.textPrimary }]}>{c.name}</Text>
                  <Text style={[styles.optionMeta, { color: selectedCustomerId === c.id ? theme.textPrimary : theme.textSecondary }]}>Balance: Rs {c.current_balance}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Select product</Text>
            {products.length === 0 ? (
              <View style={[styles.warningBox, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}><Text style={[styles.warningText, { color: theme.warning }]}>No products found. Add product first from Products screen.</Text></View>
            ) : (
              <View style={styles.optionGrid}>
                {products.map((p) => (
                  <Pressable key={p.id} onPress={() => setSelectedProductId(p.id)} style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }, selectedProductId === p.id && { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                    <Text style={[styles.optionTitle, { color: selectedProductId === p.id ? theme.primary : theme.textPrimary }]}>{p.name}</Text>
                    <Text style={[styles.optionMeta, { color: selectedProductId === p.id ? theme.textPrimary : theme.textSecondary }]}>Rs {p.selling_price} - Stock {p.stock_quantity}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.addItemRow}>
              <View style={styles.quantityBox}><AppInput label="Quantity" placeholder="1" value={quantity} onChangeText={setQuantity} keyboardType="numeric" /></View>
              <Pressable style={styles.addItemButton} onPress={handleAddItemToCart}><Text style={styles.addItemButtonText}>Add item</Text></Pressable>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Invoice items</Text>
            {cartLines.length === 0 ? (
              <View style={[styles.warningBox, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}><Text style={[styles.warningText, { color: theme.warning }]}>No items added yet. Select product, enter quantity, then press Add item.</Text></View>
            ) : (
              <View style={[styles.cartBox, { borderColor: theme.border }]}>{cartLines.map((line) => (
                <View key={line.productId} style={[styles.cartLine, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                  <View style={styles.cartLineInfo}><Text style={[styles.cartLineTitle, { color: theme.textPrimary }]}>{line.productName}</Text><Text style={[styles.cartLineMeta, { color: theme.textSecondary }]}>Rs {line.unitPrice} x {line.quantity}</Text></View>
                  <Text style={[styles.cartLineTotal, { color: theme.textPrimary }]}>Rs {line.lineTotal}</Text>
                  <Pressable style={styles.removeButton} onPress={() => handleRemoveCartLine(line.productId)}><Text style={styles.removeButtonText}>Remove</Text></Pressable>
                </View>
              ))}</View>
            )}

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Payment status</Text>
            <View style={styles.statusRow}>{(["paid", "partial", "unpaid"] as PaymentStatus[]).map((status) => (
              <Pressable
                key={status}
                onPress={() => setPaymentStatus(status)}
                style={[
                  styles.statusButton,
                  { backgroundColor: theme.cardMuted, borderColor: theme.border },
                  paymentStatus === status && styles.statusButtonActive,
                  paymentStatus === status && status === "paid" && { backgroundColor: theme.successSoft, borderColor: theme.success },
                  paymentStatus === status && status === "partial" && { backgroundColor: theme.warningSoft, borderColor: theme.warning },
                  paymentStatus === status && status === "unpaid" && { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
                ]}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    { color: theme.textSecondary },
                    paymentStatus === status && { color: theme.textPrimary },
                  ]}
                >
                  {status.toUpperCase()}
                </Text>
              </Pressable>
            ))}</View>

            {paymentStatus === "partial" ? <AppInput label="Paid amount" placeholder="Example: 100" value={partialPaidAmount} onChangeText={setPartialPaidAmount} keyboardType="numeric" /> : null}

            <View style={[styles.totalBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <View style={styles.totalRow}><Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Invoice total</Text><Text style={[styles.totalValue, { color: theme.textPrimary }]}>Rs {invoiceTotal}</Text></View>
              <View style={styles.totalRow}><Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Paid</Text><Text style={[styles.totalValue, { color: theme.textPrimary }]}>Rs {paidAmount}</Text></View>
              <View style={styles.totalRow}><Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Balance</Text><Text style={[styles.totalValue, { color: theme.textPrimary }]}>Rs {balanceDue}</Text></View>
            </View>

            {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

            <AppButton title={saving ? "Saving invoice..." : "Save invoice"} onPress={handleSaveInvoice} disabled={saving} style={styles.saveButton} fullWidth />
          </AppCard>

          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" message="Create your first invoice using the form above." />
          ) : (
            <View style={styles.listSection}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent invoices</Text>
              {invoices.map((invoice) => (
                <AppCard key={invoice.id} style={styles.invoiceCard}>
                  <View style={styles.invoiceTopRow}>
                    <View style={styles.invoiceInfo}>
                      <Text style={[styles.invoiceNo, { color: theme.textPrimary }]}>{invoice.invoice_no}</Text>
                      <Text style={[styles.invoiceMeta, { color: theme.textSecondary }]}>{invoice.customer_name} - {invoice.item_summary}</Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        invoice.payment_status === "paid" && { backgroundColor: theme.successSoft, borderColor: theme.success },
                        invoice.payment_status === "partial" && { backgroundColor: theme.warningSoft, borderColor: theme.warning },
                        invoice.payment_status === "unpaid" && { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: theme.textPrimary }]}>{invoice.payment_status}</Text>
                    </View>
                  </View>

                  <View style={styles.invoiceStatsRow}>
                    <View style={[styles.invoiceStat, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.statLabel, { color: theme.textMuted }]}>Total</Text><Text style={[styles.statValue, { color: theme.textPrimary }]}>Rs {invoice.grand_total}</Text></View>
                    <View style={[styles.invoiceStat, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.statLabel, { color: theme.textMuted }]}>Paid</Text><Text style={[styles.statValue, { color: theme.textPrimary }]}>Rs {invoice.paid_amount}</Text></View>
                    <View style={[styles.invoiceStat, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.statLabel, { color: theme.textMuted }]}>Balance</Text><Text style={[styles.statValue, { color: theme.textPrimary }]}>Rs {invoice.balance_due}</Text></View>
                  </View>

                  <AppButton
                    title="Open Invoice"
                    variant="secondary"
                    onPress={() => navigation.navigate("InvoiceDetail", { invoiceId: invoice.id })}
                  />
                </AppCard>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F6FA" },
  scrollContent: { padding: 20, paddingBottom: 36 },
  wrapper: { width: "100%", maxWidth: 900, alignSelf: "center", gap: 16 },
  headerCard: { borderColor: "#CBD5E1", borderRadius: 16 },
  formCard: { borderRadius: 16 },
  fieldLabel: { fontSize: 13, color: "#334155", marginTop: 14, fontWeight: "800" },
  cardTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A", marginBottom: 12 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryBox: { flex: 1, minWidth: 180, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#D8E0EA" },
  summaryLabel: { fontSize: 12, color: "#64748B", marginBottom: 6, fontWeight: "800", textTransform: "uppercase" },
  summaryValue: { fontSize: 26, fontWeight: "900", color: "#0F172A" },
  summaryHint: { color: "#64748B", fontSize: 12, marginTop: 4, fontWeight: "700" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  optionCard: { minWidth: 160, flexGrow: 1, padding: 14, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#D8E0EA", marginBottom: 8 },
  optionCardActive: { backgroundColor: "#EEF6FF", borderColor: "#2563EB" },
  optionTitle: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  optionTitleActive: { color: "#1D4ED8" },
  optionMeta: { color: "#475569", marginTop: 6, fontSize: 13, fontWeight: "700" },
  addItemRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 },
  quantityBox: { width: 120, minWidth: 120 },
  addItemButton: { backgroundColor: "#0F766E", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  addItemButtonText: { color: "#FFF", fontWeight: "800" },
  cartBox: { marginTop: 8, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, overflow: "hidden" },
  cartLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, gap: 10, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  cartLineInfo: { flex: 1 },
  cartLineTitle: { fontWeight: "900", color: "#0F172A" },
  cartLineMeta: { color: "#64748B", marginTop: 3 },
  cartLineTotal: { fontWeight: "900", color: "#0F172A" },
  removeButton: { backgroundColor: "#FFF1F2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#FECDD3" },
  removeButtonText: { color: "#B91C1C", fontWeight: "800" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  statusButton: { flexGrow: 1, alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#D8E0EA" },
  statusButtonActive: { borderWidth: 2 },
  statusButtonText: { fontWeight: "900", color: "#475569", fontSize: 12 },
  totalBox: { marginTop: 14, backgroundColor: "#F8FAFC", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#D8E0EA" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, gap: 12 },
  totalLabel: { color: "#64748B", fontWeight: "700" },
  totalValue: { fontWeight: "900", color: "#0F172A" },
  errorText: { color: "#DC2626", fontWeight: "700", marginTop: 8 },
  saveButton: { marginTop: 14, backgroundColor: "#1D4ED8" },
  listSection: { gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "900" },
  invoiceCard: { borderColor: "#D8E0EA", borderRadius: 16 },
  invoiceTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  invoiceInfo: { flex: 1 },
  invoiceNo: { fontWeight: "900", color: "#0F172A", fontSize: 16 },
  invoiceMeta: { color: "#475569", marginTop: 4, lineHeight: 19 },
  badge: { backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0" },
  badgeText: { fontWeight: "900", color: "#0F172A", textTransform: "uppercase", fontSize: 11 },
  invoiceStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  invoiceStat: { flex: 1, minWidth: 110, backgroundColor: "#F8FAFC", padding: 10, borderRadius: 10, borderWidth: 1 },
  statLabel: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  statValue: { fontWeight: "900", color: "#0F172A", marginTop: 3 },
  warningBox: { backgroundColor: "#FFFBEB", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#FEF3C7" },
  warningText: { color: "#92400E" },
});
