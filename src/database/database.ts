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
const LOCAL_BUSINESS_ID = "local-business-001";
const LOCAL_STORE_ID = "local-store-001";
const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

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

  if (tableName === "products" && columnName === "store_id") {
    console.log("added products.store_id");
  }
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

async function migrateCoreTables(db: SQLiteDatabase) {
  const productColumnsBefore = await getTableColumns(db, "products");
  console.log("products columns before migration", productColumnsBefore);

  const tableColumns: Record<string, Array<[string, string]>> = {
    businesses: [
      ["name", "name TEXT NOT NULL DEFAULT ''"],
      ["owner_name", "owner_name TEXT"],
      ["phone", "phone TEXT"],
      ["currency", "currency TEXT NOT NULL DEFAULT 'PKR'"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    stores: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["name", "name TEXT NOT NULL DEFAULT ''"],
      ["address", "address TEXT"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    products: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["store_id", `store_id TEXT NOT NULL DEFAULT '${LOCAL_STORE_ID}'`],
      ["name", "name TEXT NOT NULL DEFAULT ''"],
      ["sku", "sku TEXT"],
      ["barcode", "barcode TEXT"],
      ["category", "category TEXT NOT NULL DEFAULT 'general'"],
      ["unit", "unit TEXT NOT NULL DEFAULT 'pcs'"],
      ["cost_price", "cost_price REAL NOT NULL DEFAULT 0"],
      ["selling_price", "selling_price REAL NOT NULL DEFAULT 0"],
      ["stock_quantity", "stock_quantity INTEGER NOT NULL DEFAULT 0"],
      ["low_stock_threshold", "low_stock_threshold INTEGER NOT NULL DEFAULT 5"],
      ["low_stock_alert", "low_stock_alert INTEGER NOT NULL DEFAULT 5"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    customers: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["name", "name TEXT NOT NULL DEFAULT ''"],
      ["phone", "phone TEXT"],
      ["address", "address TEXT"],
      ["opening_balance", "opening_balance REAL NOT NULL DEFAULT 0"],
      ["current_balance", "current_balance REAL NOT NULL DEFAULT 0"],
      ["credit_limit", "credit_limit REAL NOT NULL DEFAULT 0"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    invoices: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["store_id", `store_id TEXT DEFAULT '${LOCAL_STORE_ID}'`],
      ["customer_id", "customer_id TEXT"],
      ["invoice_no", "invoice_no TEXT NOT NULL DEFAULT ''"],
      ["status", "status TEXT NOT NULL DEFAULT 'draft'"],
      ["payment_status", "payment_status TEXT NOT NULL DEFAULT 'unpaid'"],
      ["subtotal", "subtotal REAL NOT NULL DEFAULT 0"],
      ["discount_total", "discount_total REAL NOT NULL DEFAULT 0"],
      ["tax_total", "tax_total REAL NOT NULL DEFAULT 0"],
      ["grand_total", "grand_total REAL NOT NULL DEFAULT 0"],
      ["paid_amount", "paid_amount REAL NOT NULL DEFAULT 0"],
      ["balance_due", "balance_due REAL NOT NULL DEFAULT 0"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    invoice_items: [
      ["invoice_id", "invoice_id TEXT NOT NULL DEFAULT ''"],
      ["product_id", "product_id TEXT"],
      ["product_name_snapshot", "product_name_snapshot TEXT NOT NULL DEFAULT ''"],
      ["quantity", "quantity REAL NOT NULL DEFAULT 0"],
      ["unit_price", "unit_price REAL NOT NULL DEFAULT 0"],
      ["cost_price", "cost_price REAL NOT NULL DEFAULT 0"],
      ["discount_amount", "discount_amount REAL NOT NULL DEFAULT 0"],
      ["line_total", "line_total REAL NOT NULL DEFAULT 0"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    payments: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["invoice_id", "invoice_id TEXT"],
      ["customer_id", "customer_id TEXT"],
      ["amount", "amount REAL NOT NULL DEFAULT 0"],
      ["method", "method TEXT NOT NULL DEFAULT 'cash'"],
      ["direction", "direction TEXT NOT NULL DEFAULT 'in'"],
      ["paid_at", `paid_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["note", "note TEXT"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    cashbook_entries: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["store_id", `store_id TEXT NOT NULL DEFAULT '${LOCAL_STORE_ID}'`],
      ["entry_type", "entry_type TEXT NOT NULL DEFAULT ''"],
      ["amount_in", "amount_in REAL NOT NULL DEFAULT 0"],
      ["amount_out", "amount_out REAL NOT NULL DEFAULT 0"],
      ["description", "description TEXT"],
      ["ref_type", "ref_type TEXT"],
      ["ref_id", "ref_id TEXT"],
      ["entry_at", `entry_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    expenses: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["store_id", `store_id TEXT DEFAULT '${LOCAL_STORE_ID}'`],
      ["title", "title TEXT NOT NULL DEFAULT ''"],
      ["category", "category TEXT NOT NULL DEFAULT 'general'"],
      ["amount", "amount REAL NOT NULL DEFAULT 0"],
      ["payment_method", "payment_method TEXT NOT NULL DEFAULT 'cash'"],
      ["expense_at", `expense_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["note", "note TEXT"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    stock_movements: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["store_id", `store_id TEXT DEFAULT '${LOCAL_STORE_ID}'`],
      ["product_id", "product_id TEXT NOT NULL DEFAULT ''"],
      ["movement_type", "movement_type TEXT NOT NULL DEFAULT ''"],
      ["qty_delta", "qty_delta REAL NOT NULL DEFAULT 0"],
      ["previous_qty", "previous_qty REAL NOT NULL DEFAULT 0"],
      ["new_qty", "new_qty REAL NOT NULL DEFAULT 0"],
      ["ref_type", "ref_type TEXT"],
      ["ref_id", "ref_id TEXT"],
      ["occurred_at", `occurred_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    invoice_returns: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["store_id", `store_id TEXT NOT NULL DEFAULT '${LOCAL_STORE_ID}'`],
      ["invoice_id", "invoice_id TEXT NOT NULL DEFAULT ''"],
      ["invoice_item_local_id", "invoice_item_local_id TEXT"],
      ["product_id", "product_id TEXT"],
      ["product_name", "product_name TEXT NOT NULL DEFAULT ''"],
      ["quantity", "quantity REAL NOT NULL DEFAULT 0"],
      ["unit_price", "unit_price REAL NOT NULL DEFAULT 0"],
      ["line_total", "line_total REAL NOT NULL DEFAULT 0"],
      ["balance_reduced", "balance_reduced REAL NOT NULL DEFAULT 0"],
      ["cash_refund", "cash_refund REAL NOT NULL DEFAULT 0"],
      ["note", "note TEXT"],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
    daily_closes: [
      ["business_id", `business_id TEXT NOT NULL DEFAULT '${LOCAL_BUSINESS_ID}'`],
      ["store_id", `store_id TEXT NOT NULL DEFAULT '${LOCAL_STORE_ID}'`],
      ["expected_cash", "expected_cash REAL NOT NULL DEFAULT 0"],
      ["actual_cash", "actual_cash REAL NOT NULL DEFAULT 0"],
      ["difference", "difference REAL NOT NULL DEFAULT 0"],
      ["note", "note TEXT"],
      ["closed_at", `closed_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["created_at", `created_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["updated_at", `updated_at TEXT NOT NULL DEFAULT '${DEFAULT_TIMESTAMP}'`],
      ["sync_status", "sync_status TEXT NOT NULL DEFAULT 'pending'"],
      ["is_deleted", "is_deleted INTEGER NOT NULL DEFAULT 0"],
    ],
  };

  for (const [tableName, columns] of Object.entries(tableColumns)) {
    for (const [columnName, columnDefinition] of columns) {
      await addColumnIfMissing(db, tableName, columnName, columnDefinition);
    }
  }

  const productColumnsAfter = await getTableColumns(db, "products");
  console.log("products columns after migration", productColumnsAfter);

  if (!productColumnsAfter.includes("store_id")) {
    throw new Error(
      "SQLite migration failed: products.store_id is still missing after ALTER TABLE products ADD COLUMN store_id TEXT NOT NULL DEFAULT 'local-store-001'."
    );
  }
}

async function runMigrations(db: SQLiteDatabase) {
  await migrateCoreTables(db);
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
    console.log("DB init started");
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
    console.log("DB init finished");

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
