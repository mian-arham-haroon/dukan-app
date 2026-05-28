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
let openDbPromise: Promise<SQLiteDatabase> | null = null;
let initializationPromise: Promise<DatabaseInitResult> | null = null;
let hasInitializedDatabase = false;

function formatInitError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shortSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function runInitStep<T>(
  stepName: string,
  operation: () => Promise<T>,
  sql?: string
): Promise<T> {
  try {
    console.log(`[DB INIT] ${stepName}`);
    return await operation();
  } catch (error) {
    console.error("[DB INIT] Failed step:", {
      stepName,
      sql: sql ? shortSql(sql) : undefined,
      error,
    });
    throw error;
  }
}

async function openNativeDatabase(): Promise<SQLiteDatabase> {
  if (cachedDb) {
    return cachedDb;
  }

  if (!openDbPromise) {
    openDbPromise = (async () => {
      console.log(`[DB INIT] Opening SQLite database: ${DATABASE_NAME}`);
      const SQLite = await import("expo-sqlite");
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      if (!db) {
        throw new Error("expo-sqlite returned an empty database handle.");
      }

      cachedDb = db;
      return db;
    })().catch((error) => {
      cachedDb = null;
      openDbPromise = null;
      console.error("[DB INIT] Failed to open SQLite database.", error);
      throw error;
    });
  }

  return openDbPromise;
}

async function initializeNativeDatabase(): Promise<DatabaseInitResult> {
  try {
    const db = await openNativeDatabase();

    await runInitStep(
      "Enable SQLite pragmas",
      () =>
        db.execAsync(`
          PRAGMA foreign_keys = ON;
          PRAGMA journal_mode = WAL;
        `),
      "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;"
    );

    for (const [index, sql] of CREATE_TABLES_SQL.entries()) {
      await runInitStep(
        `Apply schema statement ${index + 1}/${CREATE_TABLES_SQL.length}`,
        () => db.execAsync(sql),
        sql
      );
    }

    const versionRow = await runInitStep(
      "Read SQLite version",
      () =>
        db.getFirstAsync<{
          "sqlite_version()": string;
        }>("SELECT sqlite_version();"),
      "SELECT sqlite_version();"
    );

    const tableCountRow = await runInitStep(
      "Count SQLite tables",
      () =>
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table';"
        ),
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table';"
    );

    hasInitializedDatabase = true;

    return {
      success: true,
      platform: Platform.OS,
      message: "Local SQLite database initialized successfully.",
      tableCount: tableCountRow?.count ?? 0,
      sqliteVersion: versionRow?.["sqlite_version()"],
    };
  } catch (error) {
    hasInitializedDatabase = false;
    initializationPromise = null;

    return {
      success: false,
      platform: Platform.OS,
      message: "Local SQLite database initialization failed.",
      tableCount: 0,
      error: formatInitError(error),
    };
  }
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

  if (hasInitializedDatabase && cachedDb) {
    return {
      success: true,
      platform: Platform.OS,
      message: "Local SQLite database already initialized.",
      tableCount: CREATE_TABLES_SQL.length,
    };
  }

  if (!initializationPromise) {
    initializationPromise = initializeNativeDatabase();
  }

  return initializationPromise;
}

export async function getDatabase(): Promise<SQLiteDatabase | null> {
  if (Platform.OS === "web") {
    return null;
  }

  const initResult = await initializeDatabase();

  if (!initResult.success) {
    throw new Error(
      `${initResult.message}${initResult.error ? ` ${initResult.error}` : ""}`
    );
  }

  return openNativeDatabase();
}
