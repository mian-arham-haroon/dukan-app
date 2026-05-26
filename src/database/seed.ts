import { Platform } from "react-native";

import { getDatabase } from "./database";

export type SeedResult = {
  success: boolean;
  message: string;
  businessCount: number;
  storeCount: number;
  error?: string;
};

export const DEFAULT_BUSINESS_ID = "local-business-001";
export const DEFAULT_STORE_ID = "local-store-001";

export async function seedDefaultBusinessAndStore(): Promise<SeedResult> {
  if (Platform.OS === "web") {
    return {
      success: true,
      message: "Web preview skipped database seed. Real seed runs on Android/iOS.",
      businessCount: 0,
      storeCount: 0,
    };
  }

  try {
    const db = await getDatabase();

    if (!db) {
      return {
        success: false,
        message: "SQLite database is not available.",
        businessCount: 0,
        storeCount: 0,
      };
    }

    await db.runAsync(
      `
      INSERT OR IGNORE INTO businesses (
        id,
        name,
        owner_name,
        phone,
        currency,
        sync_status
      )
      VALUES (?, ?, ?, ?, ?, ?);
      `,
      [
        DEFAULT_BUSINESS_ID,
        "My Dukan",
        "Business Owner",
        "",
        "PKR",
        "pending",
      ]
    );

    await db.runAsync(
      `
      INSERT OR IGNORE INTO stores (
        id,
        business_id,
        name,
        address,
        sync_status
      )
      VALUES (?, ?, ?, ?, ?);
      `,
      [
        DEFAULT_STORE_ID,
        DEFAULT_BUSINESS_ID,
        "Main Store",
        "",
        "pending",
      ]
    );

    const businessCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM businesses WHERE is_deleted = 0;"
    );

    const storeCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM stores WHERE is_deleted = 0;"
    );

    return {
      success: true,
      message: "Default business and store are ready.",
      businessCount: businessCountRow?.count ?? 0,
      storeCount: storeCountRow?.count ?? 0,
    };
  } catch (error) {
    return {
      success: false,
      message: "Default seed failed.",
      businessCount: 0,
      storeCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}