import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
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
import { AppText } from "../../components/AppText";
import { useAppTheme } from "../../theme/useAppTheme";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../../database/productsRepository";
import type { Product } from "../../types/product";

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

export function ProductsScreen() {
  const { theme } = useAppTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");

  const [error, setError] = useState("");
  const saveProductLockRef = useRef(false);
  const deleteProductLockRef = useRef(false);

  const isEditing = editingProductId !== null;

  const totalStock = useMemo(() => {
    return products.reduce((sum, product) => sum + product.stock_quantity, 0);
  }, [products]);

  async function loadProducts() {
    try {
      setLoading(true);
      const result = await getProducts();
      setProducts(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load products."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function resetForm() {
    setEditingProductId(null);
    setName("");
    setSku("");
    setCostPrice("");
    setSellingPrice("");
    setStockQuantity("");
    setError("");
  }

  function confirmDeleteProduct(): Promise<boolean> {
    if (Platform.OS === "web") {
      return Promise.resolve(
        (globalThis as any).confirm(
          "Delete this product? The product will be hidden from active listings but kept for historical invoices."
        )
      );
    }

    return new Promise((resolve) => {
      Alert.alert(
        "Delete product?",
        "This product will be removed from active product lists but historical invoices will keep the product name.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ]
      );
    });
  }

  function handleStartEdit(product: Product) {
    setEditingProductId(product.id);
    setName(product.name);
    setSku(product.sku || "");
    setCostPrice(String(product.cost_price));
    setSellingPrice(String(product.selling_price));
    setStockQuantity(String(product.stock_quantity));
    setError("");
  }

  async function handleSaveProduct() {
    if (saveProductLockRef.current || saving || deleting) {
      return;
    }

    saveProductLockRef.current = true;
    setError("");

    const productName = name.trim();

    if (!productName) {
      setError("Product name is required.");
      saveProductLockRef.current = false;
      return;
    }

    const parsedCostPrice = parseNumber(costPrice);
    const parsedSellingPrice = parseNumber(sellingPrice);
    const parsedStockQuantity = parseNumber(stockQuantity);

    if (parsedCostPrice < 0) {
      setError("Cost price must be a valid number.");
      saveProductLockRef.current = false;
      return;
    }

    if (parsedSellingPrice < 0) {
      setError("Selling price must be a valid number.");
      saveProductLockRef.current = false;
      return;
    }

    if (parsedStockQuantity < 0) {
      setError("Stock quantity must be a valid number.");
      saveProductLockRef.current = false;
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: productName,
        sku,
        costPrice: parsedCostPrice,
        sellingPrice: parsedSellingPrice,
        stockQuantity: parsedStockQuantity,
      };

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
      } else {
        await createProduct(payload);
      }

      resetForm();
      await loadProducts();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save product."
      );
    } finally {
      setSaving(false);
      saveProductLockRef.current = false;
    }
  }

  async function handleDeleteProduct(productId: string) {
    if (deleteProductLockRef.current || deleting) {
      return;
    }

    deleteProductLockRef.current = true;
    const confirmed = await confirmDeleteProduct();
    if (!confirmed) {
      deleteProductLockRef.current = false;
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await deleteProduct(productId);

      if (editingProductId === productId) {
        resetForm();
      }

      await loadProducts();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete product."
      );
    } finally {
      setDeleting(false);
      deleteProductLockRef.current = false;
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Inventory"
              title="Products"
              subtitle="Add, edit, delete, and track stock for your products."
            />

            <View style={styles.summaryRow}>
              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Products</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{products.length}</Text>
                <Text style={[styles.summaryHint, { color: theme.textMuted }]}>Active items</Text>
              </View>

              <View style={[styles.summaryBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Total stock</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{totalStock}</Text>
                <Text style={[styles.summaryHint, { color: theme.textMuted }]}>Units on hand</Text>
              </View>
            </View>
          </AppCard>

          <AppCard style={styles.formCard}>
            <View style={styles.formTitleRow}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                {isEditing ? "Edit product" : "Add product"}
              </Text>

              {isEditing ? (
                <Pressable style={[styles.cancelEditButton, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} onPress={resetForm}>
                  <Text style={[styles.cancelEditButtonText, { color: theme.textPrimary }]}>Cancel edit</Text>
                </Pressable>
              ) : null}
            </View>

            <AppInput
              label="Product name"
              placeholder="Example: Milk 1 litre"
              value={name}
              onChangeText={setName}
            />

            <AppInput
              label="SKU / Code"
              placeholder="Example: MILK-1L"
              value={sku}
              onChangeText={setSku}
              autoCapitalize="characters"
            />

            <View style={styles.formGrid}>
              <View style={styles.formColumn}>
                <AppInput
                  label="Cost price"
                  placeholder="0"
                  value={costPrice}
                  onChangeText={setCostPrice}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formColumn}>
                <AppInput
                  label="Selling price"
                  placeholder="0"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <AppInput
              label="Stock quantity"
              placeholder="0"
              value={stockQuantity}
              onChangeText={setStockQuantity}
              keyboardType="numeric"
            />

            {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

            <AppButton
              title={
                saving
                  ? "Saving..."
                  : isEditing
                  ? "Update product"
                  : "Save product"
              }
              onPress={handleSaveProduct}
              disabled={saving || deleting}
              fullWidth
            />
          </AppCard>

          {loading ? (
            <LoadingState message="Loading products..." />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products yet"
              message="Add your first product using the form above."
            />
          ) : (
            <View style={styles.listSection}>
              <View style={styles.sectionHeader}>
                <AppText variant="title" style={styles.sectionTitle}>Product list</AppText>
                <AppText variant="caption" tone="muted">{products.length} products</AppText>
              </View>

              {products.map((product) => (
                <AppCard key={product.id} style={styles.productCard}>
                  <View style={styles.productTopRow}>
                    <View style={styles.productInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.productName, { color: theme.textPrimary }]}>{product.name}</Text>
                        {product.stock_quantity <= 5 ? (
                          <View style={[styles.lowStockBadge, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
                            <Text style={[styles.lowStockBadgeText, { color: theme.warning }]}>Low stock</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.productMeta, { color: theme.textSecondary }]}>SKU: {product.sku || "N/A"} - Unit: {product.unit}</Text>
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        style={[styles.editButton, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
                        onPress={() => handleStartEdit(product)}
                      >
                        <Text style={[styles.editButtonText, { color: theme.primary }]}>Edit</Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.deleteButton,
                          { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
                          deleting ? styles.disabledButton : null,
                        ]}
                        onPress={() => {
                          if (!deleting) {
                            handleDeleteProduct(product.id);
                          }
                        }}
                      >
                        <Text style={[styles.deleteButtonText, { color: theme.danger }]}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.productStatsRow}>
                    <View style={[styles.productStat, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                      <Text style={[styles.statLabel, { color: theme.textMuted }]}>Cost</Text>
                      <Text style={[styles.statValue, { color: theme.textPrimary }]}>Rs {product.cost_price}</Text>
                    </View>

                    <View style={[styles.productStat, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                      <Text style={[styles.statLabel, { color: theme.textMuted }]}>Selling</Text>
                      <Text style={[styles.statValue, { color: theme.textPrimary }]}>Rs {product.selling_price}</Text>
                    </View>

                    <View style={[styles.productStat, { backgroundColor: product.stock_quantity <= 5 ? theme.warningSoft : theme.cardMuted, borderColor: product.stock_quantity <= 5 ? theme.warning : theme.border }]}>
                      <Text style={[styles.statLabel, { color: theme.textMuted }]}>Stock</Text>
                      <Text style={[styles.statValue, { color: product.stock_quantity <= 5 ? theme.warning : theme.textPrimary }]}>{product.stock_quantity}</Text>
                    </View>
                  </View>
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
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    minWidth: 180,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  formCard: {
    borderRadius: 16,
  },
  formTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  cancelEditButton: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  cancelEditButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  formColumn: {
    flex: 1,
    minWidth: 180,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    marginBottom: 14,
    fontWeight: "700",
  },
  listSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
  },
  productCard: {
    borderRadius: 16,
  },
  productTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  productInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  productName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  productMeta: {
    fontSize: 13,
    color: "#64748B",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  editButton: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  editButtonText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
  },
  deleteButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.5,
  },
  productStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productStat: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  lowStockBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lowStockBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
