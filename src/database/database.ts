import { Platform } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";

import { CREATE_TABLES_SQL } from "./schema";

export type DatabaseInitResult = {
  success: boolean;
  platform: string;
  message: string;
  tableCount: number;
  sqliteVersion?: string;
  error?: string;
};

const DATABASE_NAME = "dukan_app.db";

let cachedDb: SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLiteDatabase | null> {
  if (Platform.OS === "web") {
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  const SQLite = await import("expo-sqlite");
  cachedDb = await SQLite.openDatabaseAsync(DATABASE_NAME);

  return cachedDb;
}

export async function initializeDatabase(): Promise<DatabaseInitResult> {
  if (Platform.OS === "web") {
    return {
      success: true,
      platform: Platform.OS,
      message:
        "Web preview is running. Real SQLite initialization will run on Android/iOS.",
      tableCount: CREATE_TABLES_SQL.length,
    };
  }

  try {
    const db = await getDatabase();

    if (!db) {
      return {
        success: false,
        platform: Platform.OS,
        message: "SQLite database is not available on this platform.",
        tableCount: 0,
      };
    }

    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
    `);

    for (const sql of CREATE_TABLES_SQL) {
      await db.execAsync(sql);
    }

    const versionRow = await db.getFirstAsync<{
      "sqlite_version()": string;
    }>("SELECT sqlite_version();");

    const tableCountRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table';"
    );

    return {
      success: true,
      platform: Platform.OS,
      message: "Local SQLite database initialized successfully.",
      tableCount: tableCountRow?.count ?? 0,
      sqliteVersion: versionRow?.["sqlite_version()"],
    };
  } catch (error) {
    return {
      success: false,
      platform: Platform.OS,
      message: "Local SQLite database initialization failed.",
      tableCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}