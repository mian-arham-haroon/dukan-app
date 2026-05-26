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
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Inventory"
              title="Products"
              subtitle="Add, edit, delete, and track stock for your products."
            />

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Products</Text>
                <Text style={styles.summaryValue}>{products.length}</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Total stock</Text>
                <Text style={styles.summaryValue}>{totalStock}</Text>
              </View>
            </View>
          </AppCard>

          <AppCard style={styles.formCard}>
            <View style={styles.formTitleRow}>
              <Text style={styles.cardTitle}>
                {isEditing ? "Edit product" : "Add product"}
              </Text>

              {isEditing ? (
                <Pressable style={styles.cancelEditButton} onPress={resetForm}>
                  <Text style={styles.cancelEditButtonText}>Cancel edit</Text>
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

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
              <Text style={styles.sectionTitle}>Product list</Text>

              {products.map((product) => (
                <AppCard key={product.id} style={styles.productCard}>
                  <View style={styles.productTopRow}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>
                        SKU: {product.sku || "N/A"} • Unit: {product.unit}
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.editButton}
                        onPress={() => handleStartEdit(product)}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.deleteButton,
                          deleting ? styles.disabledButton : null,
                        ]}
                        onPress={() => {
                          if (!deleting) {
                            handleDeleteProduct(product.id);
                          }
                        }}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.productStatsRow}>
                    <View style={styles.productStat}>
                      <Text style={styles.statLabel}>Cost</Text>
                      <Text style={styles.statValue}>
                        Rs {product.cost_price}
                      </Text>
                    </View>

                    <View style={styles.productStat}>
                      <Text style={styles.statLabel}>Selling</Text>
                      <Text style={styles.statValue}>
                        Rs {product.selling_price}
                      </Text>
                    </View>

                    <View style={styles.productStat}>
                      <Text style={styles.statLabel}>Stock</Text>
                      <Text style={styles.statValue}>
                        {product.stock_quantity}
                      </Text>
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
  },
  wrapper: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  headerCard: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  formCard: {
    marginBottom: 16,
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
    fontWeight: "800",
    color: "#0F172A",
  },
  cancelEditButton: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cancelEditButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  formGrid: {
    flexDirection: "row",
    gap: 12,
  },
  formColumn: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    marginBottom: 14,
    fontWeight: "700",
  },
  listSection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  productCard: {
    marginBottom: 12,
  },
  productTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  productMeta: {
    fontSize: 13,
    color: "#64748B",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
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
    gap: 10,
  },
  productStat: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
});
