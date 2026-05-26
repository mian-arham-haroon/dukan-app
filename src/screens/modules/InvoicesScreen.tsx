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
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader eyebrow="Sales" title="Invoices" subtitle="Create multi-item invoices, reduce stock, collect cash, and update udhaar." />
            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}><Text style={styles.summaryLabel}>Invoices</Text><Text style={styles.summaryValue}>{invoices.length}</Text></View>
              <View style={styles.summaryBox}><Text style={styles.summaryLabel}>Sales total</Text><Text style={styles.summaryValue}>Rs {totalInvoiceAmount}</Text></View>
            </View>
          </AppCard>

          <AppCard style={styles.formCard}>
            <Text style={styles.cardTitle}>Create invoice</Text>

            <Text style={styles.fieldLabel}>Customer</Text>
            <View style={styles.optionGrid}>
              <Pressable onPress={() => setSelectedCustomerId(null)} style={[styles.optionCard, selectedCustomerId === null && styles.optionCardActive]}>
                <Text style={[styles.optionTitle, selectedCustomerId === null && styles.optionTitleActive]}>Walk-in</Text>
                <Text style={styles.optionMeta}>Cash sale only</Text>
              </Pressable>
              {customers.map((c) => (
                <Pressable key={c.id} onPress={() => setSelectedCustomerId(c.id)} style={[styles.optionCard, selectedCustomerId === c.id && styles.optionCardActive]}>
                  <Text style={[styles.optionTitle, selectedCustomerId === c.id && styles.optionTitleActive]}>{c.name}</Text>
                  <Text style={styles.optionMeta}>Balance: Rs {c.current_balance}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Select product</Text>
            {products.length === 0 ? (
              <View style={styles.warningBox}><Text style={styles.warningText}>No products found. Add product first from Products screen.</Text></View>
            ) : (
              <View style={styles.optionGrid}>
                {products.map((p) => (
                  <Pressable key={p.id} onPress={() => setSelectedProductId(p.id)} style={[styles.optionCard, selectedProductId === p.id && styles.optionCardActive]}>
                    <Text style={[styles.optionTitle, selectedProductId === p.id && styles.optionTitleActive]}>{p.name}</Text>
                    <Text style={styles.optionMeta}>Rs {p.selling_price} • Stock {p.stock_quantity}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.addItemRow}>
              <View style={styles.quantityBox}><AppInput label="Quantity" placeholder="1" value={quantity} onChangeText={setQuantity} keyboardType="numeric" /></View>
              <Pressable style={styles.addItemButton} onPress={handleAddItemToCart}><Text style={styles.addItemButtonText}>Add item</Text></Pressable>
            </View>

            <Text style={styles.fieldLabel}>Invoice items</Text>
            {cartLines.length === 0 ? (
              <View style={styles.warningBox}><Text style={styles.warningText}>No items added yet. Select product, enter quantity, then press Add item.</Text></View>
            ) : (
              <View style={styles.cartBox}>{cartLines.map((line) => (
                <View key={line.productId} style={styles.cartLine}>
                  <View style={styles.cartLineInfo}><Text style={styles.cartLineTitle}>{line.productName}</Text><Text style={styles.cartLineMeta}>Rs {line.unitPrice} × {line.quantity} = Rs {line.lineTotal}</Text></View>
                  <Pressable style={styles.removeButton} onPress={() => handleRemoveCartLine(line.productId)}><Text style={styles.removeButtonText}>Remove</Text></Pressable>
                </View>
              ))}</View>
            )}

            <Text style={styles.fieldLabel}>Payment status</Text>
            <View style={styles.statusRow}>{(["paid", "partial", "unpaid"] as PaymentStatus[]).map((status) => (
              <Pressable key={status} onPress={() => setPaymentStatus(status)} style={[styles.statusButton, paymentStatus === status && styles.statusButtonActive]}>
                <Text style={[styles.statusButtonText, paymentStatus === status && styles.statusButtonTextActive]}>{status.toUpperCase()}</Text>
              </Pressable>
            ))}</View>

            {paymentStatus === "partial" ? <AppInput label="Paid amount" placeholder="Example: 100" value={partialPaidAmount} onChangeText={setPartialPaidAmount} keyboardType="numeric" /> : null}

            <View style={styles.totalBox}>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Invoice total</Text><Text style={styles.totalValue}>Rs {invoiceTotal}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Paid</Text><Text style={styles.totalValue}>Rs {paidAmount}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Balance</Text><Text style={styles.totalValue}>Rs {balanceDue}</Text></View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton title={saving ? "Saving invoice..." : "Save invoice"} onPress={handleSaveInvoice} disabled={saving} />
          </AppCard>

          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" message="Create your first invoice using the form above." />
          ) : (
            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>Recent invoices</Text>
              {invoices.map((invoice) => (
                <AppCard key={invoice.id} style={styles.invoiceCard}>
                  <View style={styles.invoiceTopRow}>
                    <View style={styles.invoiceInfo}>
                      <Text style={styles.invoiceNo}>{invoice.invoice_no}</Text>
                      <Text style={styles.invoiceMeta}>{invoice.customer_name} • {invoice.item_summary}</Text>
                    </View>
                    <View style={styles.badge}><Text style={styles.badgeText}>{invoice.payment_status}</Text></View>
                  </View>

                  <View style={styles.invoiceStatsRow}>
                    <View style={styles.invoiceStat}><Text style={styles.statLabel}>Total</Text><Text style={styles.statValue}>Rs {invoice.grand_total}</Text></View>
                    <View style={styles.invoiceStat}><Text style={styles.statLabel}>Paid</Text><Text style={styles.statValue}>Rs {invoice.paid_amount}</Text></View>
                    <View style={styles.invoiceStat}><Text style={styles.statLabel}>Balance</Text><Text style={styles.statValue}>Rs {invoice.balance_due}</Text></View>
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
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20 },
  wrapper: { width: "100%", maxWidth: 900, alignSelf: "center" },
  headerCard: { marginBottom: 16 },
  formCard: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: "#475569", marginTop: 12, fontWeight: "700" },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 12 },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryBox: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  summaryLabel: { fontSize: 13, color: "#64748B", marginBottom: 6 },
  summaryValue: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  optionCard: { padding: 12, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", marginRight: 8, marginBottom: 8 },
  optionCardActive: { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" },
  optionTitle: { fontWeight: "800", color: "#0F172A" },
  optionTitleActive: { color: "#1E293B" },
  optionMeta: { color: "#64748B", marginTop: 6 },
  addItemRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  quantityBox: { width: 120 },
  addItemButton: { backgroundColor: "#0EA5E9", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  addItemButtonText: { color: "#FFF", fontWeight: "800" },
  cartBox: { marginTop: 8 },
  cartLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  cartLineInfo: {},
  cartLineTitle: { fontWeight: "800" },
  cartLineMeta: { color: "#64748B" },
  removeButton: { backgroundColor: "#FEE2E2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  removeButtonText: { color: "#B91C1C", fontWeight: "800" },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  statusButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
  statusButtonActive: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  statusButtonText: { fontWeight: "800" },
  statusButtonTextActive: { color: "#065F46" },
  totalBox: { marginTop: 12, backgroundColor: "#FFF", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  totalLabel: { color: "#64748B" },
  totalValue: { fontWeight: "800" },
  errorText: { color: "#DC2626", fontWeight: "700", marginTop: 8 },
  listSection: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  invoiceCard: { marginBottom: 10 },
  invoiceTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  invoiceInfo: {},
  invoiceNo: { fontWeight: "800" },
  invoiceMeta: { color: "#64748B" },
  badge: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontWeight: "800", color: "#0F172A" },
  invoiceStatsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  invoiceStat: {},
  statLabel: { color: "#64748B" },
  statValue: { fontWeight: "800" },
  warningBox: { backgroundColor: "#FFFBEB", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#FEF3C7" },
  warningText: { color: "#92400E" },
});
