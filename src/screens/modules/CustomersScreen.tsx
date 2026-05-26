import React, { useEffect, useMemo, useState } from "react";
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
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../../database/customersRepository";
import type { Customer } from "../../types/customer";

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

export function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const [error, setError] = useState("");

  const isEditing = editingCustomerId !== null;

  const totalBalance = useMemo(() => {
    return customers.reduce(
      (sum, customer) => sum + customer.current_balance,
      0
    );
  }, [customers]);

  async function loadCustomers() {
    try {
      setLoading(true);
      const result = await getCustomers();
      setCustomers(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load customers."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function resetForm() {
    setEditingCustomerId(null);
    setName("");
    setPhone("");
    setAddress("");
    setOpeningBalance("");
    setCreditLimit("");
    setError("");
  }

  function confirmDeleteCustomer(): Promise<boolean> {
    if (Platform.OS === "web") {
      return Promise.resolve(
        (globalThis as any).confirm(
          "Delete this customer? The customer will be hidden from active listings but historical invoices will keep the customer name."
        )
      );
    }

    return new Promise((resolve) => {
      Alert.alert(
        "Delete customer?",
        "This customer will be removed from active customer lists but historical invoices will keep the customer name.",
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

  function handleStartEdit(customer: Customer) {
    setEditingCustomerId(customer.id);
    setName(customer.name);
    setPhone(customer.phone || "");
    setAddress(customer.address || "");
    setOpeningBalance(String(customer.opening_balance));
    setCreditLimit(String(customer.credit_limit));
    setError("");
  }

  async function handleSaveCustomer() {
    if (saving || deleting) {
      return;
    }

    setSaving(true);
    setError("");

    const customerName = name.trim();

    if (!customerName) {
      setError("Customer name is required.");
      setSaving(false);
      return;
    }

    const parsedOpeningBalance = parseNumber(openingBalance);
    const parsedCreditLimit = parseNumber(creditLimit);

    if (parsedOpeningBalance < 0) {
      setError("Opening balance must be a valid number.");
      setSaving(false);
      return;
    }

    if (parsedCreditLimit < 0) {
      setError("Credit limit must be a valid number.");
      setSaving(false);
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: customerName,
        phone,
        address,
        openingBalance: parsedOpeningBalance,
        creditLimit: parsedCreditLimit,
      };

      if (editingCustomerId) {
        await updateCustomer(editingCustomerId, payload);
      } else {
        await createCustomer(payload);
      }

      resetForm();
      await loadCustomers();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save customer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustomer(customerId: string) {
    if (deleting) {
      return;
    }

    const confirmed = await confirmDeleteCustomer();
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await deleteCustomer(customerId);

      if (editingCustomerId === customerId) {
        resetForm();
      }

      await loadCustomers();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete customer."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="Customer records"
              title="Customers"
              subtitle="Add, edit, delete, and track customer opening balances."
            />

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Customers</Text>
                <Text style={styles.summaryValue}>{customers.length}</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Total balance</Text>
                <Text style={styles.summaryValue}>Rs {totalBalance}</Text>
              </View>
            </View>
          </AppCard>

          <AppCard style={styles.formCard}>
            <View style={styles.formTitleRow}>
              <Text style={styles.cardTitle}>
                {isEditing ? "Edit customer" : "Add customer"}
              </Text>

              {isEditing ? (
                <Pressable style={styles.cancelEditButton} onPress={resetForm}>
                  <Text style={styles.cancelEditButtonText}>Cancel edit</Text>
                </Pressable>
              ) : null}
            </View>

            <AppInput
              label="Customer name"
              placeholder="Example: Ali Khan"
              value={name}
              onChangeText={setName}
            />

            <AppInput
              label="Phone"
              placeholder="Example: 03001234567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <AppInput
              label="Address"
              placeholder="Example: Main bazaar"
              value={address}
              onChangeText={setAddress}
            />

            <View style={styles.formGrid}>
              <View style={styles.formColumn}>
                <AppInput
                  label="Opening balance"
                  placeholder="0"
                  value={openingBalance}
                  onChangeText={setOpeningBalance}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formColumn}>
                <AppInput
                  label="Credit limit"
                  placeholder="0"
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title={
                saving
                  ? "Saving..."
                  : isEditing
                  ? "Update customer"
                  : "Save customer"
              }
              onPress={handleSaveCustomer}
              disabled={saving || deleting}
            />
          </AppCard>

          {loading ? (
            <LoadingState message="Loading customers..." />
          ) : customers.length === 0 ? (
            <EmptyState
              title="No customers yet"
              message="Add your first customer using the form above."
            />
          ) : (
            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>Customer list</Text>

              {customers.map((customer) => (
                <AppCard key={customer.id} style={styles.customerCard}>
                  <View style={styles.customerTopRow}>
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{customer.name}</Text>

                      <Text style={styles.customerMeta}>
                        Phone: {customer.phone || "N/A"}
                      </Text>

                      <Text style={styles.customerMeta}>
                        Address: {customer.address || "N/A"}
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.editButton}
                        onPress={() => {
                          if (!saving && !deleting) {
                            handleStartEdit(customer);
                          }
                        }}
                        disabled={saving || deleting}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.deleteButton,
                          (saving || deleting) ? styles.disabledButton : null,
                        ]}
                        onPress={() => {
                          if (!saving && !deleting) {
                            handleDeleteCustomer(customer.id);
                          }
                        }}
                        disabled={saving || deleting}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.customerStatsRow}>
                    <View style={styles.customerStat}>
                      <Text style={styles.statLabel}>Opening</Text>
                      <Text style={styles.statValue}>
                        Rs {customer.opening_balance}
                      </Text>
                    </View>

                    <View style={styles.customerStat}>
                      <Text style={styles.statLabel}>Current</Text>
                      <Text style={styles.statValue}>
                        Rs {customer.current_balance}
                      </Text>
                    </View>

                    <View style={styles.customerStat}>
                      <Text style={styles.statLabel}>Limit</Text>
                      <Text style={styles.statValue}>
                        Rs {customer.credit_limit}
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
  customerCard: {
    marginBottom: 12,
  },
  customerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  customerMeta: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 3,
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
  customerStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  customerStat: {
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