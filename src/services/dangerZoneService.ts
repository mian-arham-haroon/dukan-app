import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";

import { getDatabase } from "../database/database";
import { getUserBusinessContext } from "./businessCloudService";
import { supabase } from "./supabase";

type DangerResult = {
  success: boolean;
  message: string;
};

const WEB_KEYS_TO_CLEAR = [
  "dukan_app_web_products",
  "dukan_app_web_customers",
  "dukan_app_web_invoices",
  "dukan_app_web_invoice_items",
  "dukan_app_web_payments",
  "dukan_app_web_cashbook_entries",
  "dukan_app_web_expenses",
  "dukan_app_web_daily_closes",
  "dukan_app_web_sync_queue",
];

const SQLITE_TABLES_TO_CLEAR = [
  "sync_queue",
  "daily_closes",
  "expenses",
  "cashbook_entries",
  "payments",
  "invoice_items",
  "invoices",
  "customers",
  "products",
];

async function deleteCloudRowsOrSoftDelete(
  tableName: "products" | "customers",
  businessId: string
): Promise<void> {
  const hardDeleteResult = await supabase
    .from(tableName)
    .delete()
    .eq("business_id", businessId);

  if (!hardDeleteResult.error) {
    return;
  }

  const softDeleteResult = await supabase
    .from(tableName)
    .update({
      is_deleted: true,
      sync_status: "synced",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (softDeleteResult.error) {
    throw softDeleteResult.error;
  }
}

export async function clearLocalAppData(): Promise<DangerResult> {
  if (Platform.OS === "web") {
    const storage = (globalThis as any).localStorage;

    if (storage) {
      for (const key of WEB_KEYS_TO_CLEAR) {
        storage.removeItem(key);
      }
    }

    return {
      success: true,
      message: "Local app data cleared on this device.",
    };
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  for (const tableName of SQLITE_TABLES_TO_CLEAR) {
    try {
      await db.runAsync(`DELETE FROM ${tableName};`);
    } catch {
      // Some tables may not exist yet in early phases. Ignore safely.
    }
  }

  return {
    success: true,
    message: "Local app data cleared on this device.",
  };
}

export async function deleteProductsAndCustomersEverywhere(
  user: User
): Promise<DangerResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found.");
  }

  await deleteCloudRowsOrSoftDelete("products", context.business.id);
  await deleteCloudRowsOrSoftDelete("customers", context.business.id);

  await clearLocalAppData();

  return {
    success: true,
    message:
      "Products and customers deleted from cloud and local app data cleared.",
  };
}