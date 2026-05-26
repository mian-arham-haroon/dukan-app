import { AppState, AppStateStatus, Platform } from "react-native";
import type { User } from "@supabase/supabase-js";
import {
  getSyncQueueStats,
  retryPendingSyncQueue,
} from "../database/syncQueueRepository";
import { supabase } from "./supabase";
import { pushInvoicesToCloud } from "./invoiceCloudSyncService";
import { pushInvoiceItemsToCloud } from "./invoiceItemsCloudSyncService";
import { pushPaymentsAndCashbookToCloud } from "./paymentsCashbookCloudSyncService";
import { pushDailyClosesToCloud } from "./dailyCloseCloudSyncService";

let isAutoSyncRunning = false;
let lastAutoSyncAt = 0;
let appStateSubscription: { remove: () => void } | null = null;

const AUTO_SYNC_COOLDOWN_MS = 15000;

function canRunAutoSync() {
  const now = Date.now();

  if (isAutoSyncRunning) {
    return false;
  }

  if (now - lastAutoSyncAt < AUTO_SYNC_COOLDOWN_MS) {
    return false;
  }

  return true;
}

async function runAutoSalesSync(): Promise<void> {
  try {
    const authResult = await supabase.auth.getUser();
    if (authResult.error || !authResult.data.user) {
      console.log("[AUTO SYNC] No authenticated user for sales sync.");
      return;
    }

    const user = authResult.data.user as User;

    console.log("[AUTO SYNC] Starting sales sync.");

    await pushInvoicesToCloud(user);
    await pushInvoiceItemsToCloud(user);
    await pushPaymentsAndCashbookToCloud(user);
    await pushDailyClosesToCloud(user);

    console.log("[AUTO SYNC] Sales sync complete.");
  } catch (error) {
    console.warn("[AUTO SYNC] Sales sync failed.", error);
  }
}

export async function runAutoSync(reason: string = "auto"): Promise<void> {
  if (!canRunAutoSync()) {
    return;
  }

  isAutoSyncRunning = true;
  lastAutoSyncAt = Date.now();

  try {
    const stats = await getSyncQueueStats();

    console.log(
      `[AUTO SYNC] Starting. Reason: ${reason}. Pending queue items: ${stats.pending}`
    );

    if (stats.pending > 0) {
      const result = await retryPendingSyncQueue();

      console.log(
        `[AUTO SYNC] Queue sync finished. Pushed: ${result.pushed}, Failed: ${result.failed}`
      );
    } else {
      console.log("[AUTO SYNC] No pending queue items to sync.");
    }

    await runAutoSalesSync();
  } catch (error) {
    console.warn("[AUTO SYNC] Failed: - autoSyncService.ts", error);
  } finally {
    isAutoSyncRunning = false;
  }
}

export function startAutoSyncWatcher(): void {
  if (appStateSubscription) {
    return;
  }

  setTimeout(() => {
    runAutoSync("app_start");
  }, 1500);

  appStateSubscription = AppState.addEventListener(
    "change",
    (nextState: AppStateStatus) => {
      if (nextState === "active") {
        runAutoSync("app_focus");
      }
    }
  );

  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.addEventListener("focus", () => {
      runAutoSync("web_focus");
    });

    window.addEventListener("online", () => {
      runAutoSync("web_online");
    });
  }
}

export function stopAutoSyncWatcher(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}