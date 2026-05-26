import { pullProductsAndCustomersFromCloud } from "../../services/cloudRestoreService";
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
import { getUserBusinessContext } from "../../services/businessCloudService";
import {
  getCurrentSyncQueueSummary,
  pushProductsAndCustomersToCloud,
  queueProductsAndCustomersForSync,
  syncPendingQueue,
} from "../../services/manualSyncService";
import { pushInvoicesToCloud } from "../../services/invoiceCloudSyncService";
import { pushInvoiceItemsToCloud } from "../../services/invoiceItemsCloudSyncService";
import { pushInvoiceReturnsToCloud } from "../../services/returnsCloudSyncService";
import { pushPaymentsAndCashbookToCloud } from "../../services/paymentsCashbookCloudSyncService";
import { pushDailyClosesToCloud } from "../../services/dailyCloseCloudSyncService";
import {
  pullFullSalesDataFromCloud,
  pullSalesDataFromCloud,
} from "../../services/salesCloudRestoreService";
import {
  clearLocalAppData,
  deleteProductsAndCustomersEverywhere,
} from "../../services/dangerZoneService";
import { supabase } from "../../services/supabase";
import { useAuthStore } from "../../store/authStore";
import { IS_DEV_TOOLS_ENABLED } from "../../constants/config";
import type { CloudBusinessContext } from "../../types/cloud";
import type { SyncQueueSummary } from "../../types/sync";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

function confirmDangerAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const confirmFunction = (globalThis as any).confirm;

    if (typeof confirmFunction === "function") {
      return Promise.resolve(confirmFunction(`${title}\n\n${message}`));
    }

    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
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
    ]);
  });
}

export function SettingsScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [context, setContext] = useState<CloudBusinessContext | null>(null);

  const [queueSummary, setQueueSummary] = useState<SyncQueueSummary>({
    pending: 0,
    synced: 0,
    failed: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  const isDevToolsEnabled = IS_DEV_TOOLS_ENABLED;
  const isActionBusy = signingOut || syncing;

  async function refreshSyncQueueSummary() {
    const summary = await getCurrentSyncQueueSummary();
    setQueueSummary(summary);
  }

  async function loadCloudStatus() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const result = await getUserBusinessContext(user);
      setContext(result);

      await refreshSyncQueueSummary();

      if (!result.business) {
        setError("No cloud business found for this account.");
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load cloud status."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCloudStatus();
  }, []);

  async function handlePushLocalDataToCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pushProductsAndCustomersToCloud();

      setSyncMessage(result.message);
      setSuccessMessage("Products and customers queued and pushed to Supabase.");

      await refreshSyncQueueSummary();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Failed to push local data to cloud."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePushInvoicesToCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pushInvoicesToCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage("Invoices pushed to Supabase.");
    } catch (pushError) {
      setError(
        pushError instanceof Error
          ? pushError.message
          : "Failed to push invoices to cloud."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePushInvoiceItemsToCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pushInvoiceItemsToCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage("Invoice items pushed to Supabase.");
    } catch (pushError) {
      setError(
        pushError instanceof Error
          ? pushError.message
          : "Failed to push invoice items to cloud."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePushInvoiceReturnsToCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pushInvoiceReturnsToCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage(`Invoice returns pushed to cloud. Count: ${result.returnRecordsPushed}`);
    } catch (pushError) {
      setError(
        pushError instanceof Error
          ? pushError.message
          : "Failed to push invoice returns to cloud."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePushPaymentsAndCashbookToCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pushPaymentsAndCashbookToCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage("Payments, cashbook, and returns pushed to Supabase.");
    } catch (pushError) {
      setError(
        pushError instanceof Error
          ? pushError.message
          : "Failed to push payments and cashbook to cloud."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePushDailyClosesToCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pushDailyClosesToCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage("Daily close records pushed to Supabase.");
    } catch (pushError) {
      setError(
        pushError instanceof Error
          ? pushError.message
          : "Failed to push daily close records to cloud."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleBuildSyncQueueOnly() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    try {
      setSyncing(true);

      const result = await queueProductsAndCustomersForSync();

      setSyncMessage(result.message);
      setSuccessMessage("Products and customers added to local sync queue.");

      await refreshSyncQueueSummary();
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
          : "Failed to build sync queue."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearLocalDataOnly() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    const confirmed = await confirmDangerAction(
      "Clear local data?",
      "This will delete local products, customers, invoices, expenses, cashbook, and sync queue from this device only. Cloud data will stay safe."
    );

    if (!confirmed) {
      return;
    }

    try {
      setSyncing(true);

      const result = await clearLocalAppData();

      setSuccessMessage(result.message);
      setSyncMessage(result.message);

      await refreshSyncQueueSummary();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to clear local data."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteProductsAndCustomersEverywhere() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    const confirmed = await confirmDangerAction(
      "Delete cloud and local data?",
      "This will delete products and customers from Supabase and clear local app data on this device. This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      setSyncing(true);

      const result = await deleteProductsAndCustomersEverywhere(user);

      setSuccessMessage(result.message);
      setSyncMessage(result.message);

      await refreshSyncQueueSummary();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete business data."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePullCloudDataToThisDevice() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pullProductsAndCustomersFromCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage("Cloud data restored to this device.");

      await refreshSyncQueueSummary();
    } catch (pullError) {
      setError(
        pullError instanceof Error
          ? pullError.message
          : "Failed to pull cloud data."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePullSalesDataFromCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pullSalesDataFromCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage("Sales data restored from Supabase.");
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Failed to restore sales data from cloud."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handlePullFullSalesDataFromCloud() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await pullFullSalesDataFromCloud(user);

      setSyncMessage(result.message);
      setSuccessMessage("Full cloud restore completed for products, customers, and sales data.");
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Failed to restore full cloud data."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleRetryPendingSync() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    if (!user) {
      setError("No logged-in user found. Please login again.");
      return;
    }

    try {
      setSyncing(true);

      const result = await syncPendingQueue();

      setSyncMessage(result.message);
      setSuccessMessage("Pending sync queue retried.");

      await refreshSyncQueueSummary();
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Failed to retry sync queue."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    setError("");
    setSuccessMessage("");
    setSyncMessage("");

    try {
      setSigningOut(true);

      await supabase.auth.signOut();
      clearSession();

      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "Failed to logout."
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading settings..." />;
  }

  const business = context?.business ?? null;
  const store = context?.store ?? null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppCard style={styles.headerCard}>
            <AppHeader
              eyebrow="System"
              title="Settings"
              subtitle="Check account, business, store, cloud connection, and sync queue status."
            />
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Account</Text>

            <View style={styles.infoBox}>
              <Text style={styles.label}>User ID</Text>
              <Text style={styles.value}>{user?.id ?? "Not logged in"}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email ?? "N/A"}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.value}>{context?.role ?? "N/A"}</Text>
            </View>
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Cloud business</Text>

            {business ? (
              <>
                <View style={styles.statusBoxGood}>
                  <Text style={styles.statusTitle}>Cloud setup complete</Text>
                  <Text style={styles.statusText}>
                    This account has a business and store connected in Supabase.
                  </Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.label}>Business name</Text>
                  <Text style={styles.value}>{business.name}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.label}>Business ID</Text>
                  <Text style={styles.value}>{business.id}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.label}>Currency</Text>
                  <Text style={styles.value}>{business.currency}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.label}>Country</Text>
                  <Text style={styles.value}>{business.country}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.statusBoxBad}>
                  <Text style={styles.statusTitleBad}>Cloud setup missing</Text>
                  <Text style={styles.statusTextBad}>
                    This user exists, but no business was found.
                  </Text>
                </View>

                <AppButton
                  title="Setup business"
                  onPress={() => navigation.navigate("BusinessSetup")}
                />
              </>
            )}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Store</Text>

            {store ? (
              <>
                <View style={styles.infoBox}>
                  <Text style={styles.label}>Store name</Text>
                  <Text style={styles.value}>{store.name}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.label}>Store code</Text>
                  <Text style={styles.value}>{store.code}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.label}>Address</Text>
                  <Text style={styles.value}>{store.address || "N/A"}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.label}>Status</Text>
                  <Text style={styles.value}>
                    {store.is_active ? "Active" : "Inactive"}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.statusBoxBad}>
                <Text style={styles.statusTitleBad}>No active store found</Text>
                <Text style={styles.statusTextBad}>
                  Business exists, but active store was not loaded.
                </Text>
              </View>
            )}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Sync queue</Text>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Queue status</Text>
              <Text style={styles.value}>
                Pending: {queueSummary.pending} | Synced: {queueSummary.synced} | Failed: {queueSummary.failed} | Total: {queueSummary.total}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Last sync</Text>
              <Text style={styles.value}>
                {queueSummary.lastSyncedAt
                  ? new Date(queueSummary.lastSyncedAt).toLocaleString()
                  : "Never"}
              </Text>
            </View>

            {isDevToolsEnabled ? (
              <>
                <AppButton
                  title={syncing ? "Working..." : "Build Products & Customers Sync Queue"}
                  variant="secondary"
                  onPress={handleBuildSyncQueueOnly}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={syncing ? "Working..." : "Retry Pending Sync Queue"}
                  variant="secondary"
                  onPress={handleRetryPendingSync}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={
                    syncing
                      ? "Pushing local data..."
                      : "Push Products & Customers to Cloud"
                  }
                  variant="secondary"
                  onPress={handlePushLocalDataToCloud}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={syncing ? "Working..." : "Push Invoices to Cloud"}
                  variant="secondary"
                  onPress={handlePushInvoicesToCloud}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={syncing ? "Working..." : "Push Invoice Items to Cloud"}
                  variant="secondary"
                  onPress={handlePushInvoiceItemsToCloud}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={syncing ? "Working..." : "Push Invoice Returns to Cloud"}
                  variant="secondary"
                  onPress={handlePushInvoiceReturnsToCloud}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={syncing ? "Working..." : "Push Payments & Cashbook to Cloud"}
                  variant="secondary"
                  onPress={handlePushPaymentsAndCashbookToCloud}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={syncing ? "Working..." : "Push Daily Closes to Cloud"}
                  variant="secondary"
                  onPress={handlePushDailyClosesToCloud}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={
                    syncing
                      ? "Restoring cloud data..."
                      : "Pull Products & Customers from Cloud"
                  }
                  variant="secondary"
                  onPress={handlePullCloudDataToThisDevice}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={
                    syncing
                      ? "Restoring full cloud data..."
                      : "Pull Full Sales Data from Cloud"
                  }
                  variant="secondary"
                  onPress={handlePullFullSalesDataFromCloud}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={syncing ? "Working..." : "Pull Sales Data from Cloud"}
                  variant="secondary"
                  onPress={handlePullSalesDataFromCloud}
                  disabled={isActionBusy}
                />
              </>
            ) : (
              <Text style={styles.helpText}>
                Developer sync tools are hidden in production mode.
              </Text>
            )}

            {syncMessage ? (
              <Text style={styles.successText}>{syncMessage}</Text>
            ) : null}
          </AppCard>

          <AppCard style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Actions</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {successMessage ? (
              <Text style={styles.successText}>{successMessage}</Text>
            ) : null}

            <AppButton
              title="Refresh cloud status"
              variant="secondary"
              onPress={loadCloudStatus}
              disabled={isActionBusy}
            />

            <View style={styles.spacer} />

            <AppButton
              title={isActionBusy ? "Syncing..." : "Sync now"}
              variant="secondary"
              onPress={handlePushPaymentsAndCashbookToCloud}
              disabled={isActionBusy}
            />

            <View style={styles.spacer} />

            <AppButton
              title={signingOut ? "Logging out..." : "Logout"}
              variant="secondary"
              onPress={handleLogout}
              disabled={isActionBusy}
            />

            {isDevToolsEnabled ? (
              <>
                <View style={styles.spacer} />

                <Text style={styles.dangerTitle}>Developer tools</Text>

                <Text style={styles.dangerText}>
                  Developer sync and cloud reset actions are only visible in dev mode.
                </Text>

                <AppButton
                  title={syncing ? "Working..." : "Clear Local Data Only"}
                  variant="secondary"
                  onPress={handleClearLocalDataOnly}
                  disabled={isActionBusy}
                />

                <View style={styles.spacer} />

                <AppButton
                  title={
                    syncing
                      ? "Deleting business data..."
                      : "Delete Products & Customers Everywhere"
                  }
                  variant="secondary"
                  onPress={handleDeleteProductsAndCustomersEverywhere}
                  disabled={isActionBusy}
                />
              </>
            ) : null}
          </AppCard>
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
  sectionCard: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "800",
    marginBottom: 6,
  },
  value: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "800",
    lineHeight: 20,
  },
  statusBoxGood: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statusTitle: {
    fontSize: 15,
    color: "#166534",
    fontWeight: "900",
    marginBottom: 6,
  },
  statusText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "700",
    lineHeight: 19,
  },
  statusBoxBad: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statusTitleBad: {
    fontSize: 15,
    color: "#991B1B",
    fontWeight: "900",
    marginBottom: 6,
  },
  statusTextBad: {
    fontSize: 13,
    color: "#991B1B",
    fontWeight: "700",
    lineHeight: 19,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
  successText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  dangerTitle: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "900",
    color: "#b91c1c",
  },
  dangerText: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    color: "#7f1d1d",
  },
  helpText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  spacer: {
    height: 12,
  },
});