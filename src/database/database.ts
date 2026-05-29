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

async function getTableColumns(
  db: SQLiteDatabase,
  tableName: string
): Promise<string[]> {
  const rows = await runInitStep(
    `Read ${tableName} columns`,
    () => db.getAllAsync<{ name: string }>(`PRAGMA table_info('${tableName}');`),
    `PRAGMA table_info('${tableName}');`
  );

  return rows.map((row) => row.name);
}

async function checkColumnExists(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const columns = await getTableColumns(db, tableName);
  return columns.includes(columnName);
}

async function addColumnIfMissing(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const exists = await checkColumnExists(db, tableName, columnName);

  if (exists) {
    return;
  }

  const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition};`;
  await runInitStep(
    `Add ${tableName}.${columnName}`,
    () => db.execAsync(sql),
    sql
  );
}

async function migrateSyncQueueTable(db: SQLiteDatabase) {
  const columns = await getTableColumns(db, "sync_queue");
  const hasLegacyRequiredColumns =
    columns.includes("table_name") ||
    columns.includes("record_id") ||
    columns.includes("payload_json");

  if (hasLegacyRequiredColumns) {
    await runInitStep(
      "Rebuild legacy sync_queue table",
      () =>
        db.execAsync(`
          CREATE TABLE IF NOT EXISTS sync_queue_new (
            id TEXT PRIMARY KEY NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            local_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            synced_at TEXT
          );

          INSERT OR IGNORE INTO sync_queue_new (
            id,
            entity_type,
            entity_id,
            operation,
            local_id,
            payload,
            status,
            error_message,
            retry_count,
            created_at,
            updated_at,
            synced_at
          )
          SELECT
            id,
            CASE
              WHEN table_name IN ('customer', 'customers') THEN 'customer'
              ELSE 'product'
            END,
            record_id,
            operation,
            record_id,
            payload_json,
            status,
            last_error,
            COALESCE(attempts, 0),
            created_at,
            updated_at,
            NULL
          FROM sync_queue;

          DROP TABLE sync_queue;
          ALTER TABLE sync_queue_new RENAME TO sync_queue;
        `),
      "Rebuild legacy sync_queue table"
    );

    return;
  }

  await addColumnIfMissing(db, "sync_queue", "entity_type", "entity_type TEXT");
  await addColumnIfMissing(db, "sync_queue", "entity_id", "entity_id TEXT");
  await addColumnIfMissing(db, "sync_queue", "local_id", "local_id TEXT");
  await addColumnIfMissing(db, "sync_queue", "payload", "payload TEXT");
  await addColumnIfMissing(db, "sync_queue", "error_message", "error_message TEXT");
  await addColumnIfMissing(db, "sync_queue", "retry_count", "retry_count INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "sync_queue", "synced_at", "synced_at TEXT");

  await runInitStep(
    "Backfill sync_queue mirrored IDs",
    () =>
      db.execAsync(`
        UPDATE sync_queue
        SET entity_id = COALESCE(entity_id, local_id),
            local_id = COALESCE(local_id, entity_id)
        WHERE entity_id IS NULL OR local_id IS NULL;
      `),
    "UPDATE sync_queue SET entity_id/local_id mirrors"
  );
}

async function runMigrations(db: SQLiteDatabase) {
  await migrateSyncQueueTable(db);
  await addColumnIfMissing(
    db,
    "invoice_returns",
    "invoice_item_local_id",
    "invoice_item_local_id TEXT"
  );

  await runInitStep(
    "Recreate sync_queue status index",
    () =>
      db.execAsync(
        "CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);"
      ),
    "CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);"
  );
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

    await runInitStep("Run SQLite migrations", () => runMigrations(db));

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
