import { Platform } from "react-native";

import { getDatabase } from "./database";
import { supabase } from "../services/supabase";

const WEB_PRODUCTS_KEY = "dukan_app_web_products";
const WEB_CUSTOMERS_KEY = "dukan_app_web_customers";
const WEB_SYNC_QUEUE_KEY = "dukan_app_web_sync_queue";

type SyncEntityType = "product" | "customer";
type SyncOperation = "upsert" | "delete";
type SyncStatus = "pending" | "synced" | "failed";

export type SyncQueueItem = {
  id: string;
  entity_type: SyncEntityType;
  operation: SyncOperation;
  local_id: string;
  payload: string;
  status: SyncStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

export type SyncQueueStats = {
  pending: number;
  synced: number;
  failed: number;
  total: number;
  lastSyncedAt: string | null;
};

type LocalProduct = {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  cost_price?: number;
  selling_price?: number;
  stock_quantity?: number;
  is_deleted?: number;
};

type LocalCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  opening_balance?: number;
  current_balance?: number;
  credit_limit?: number;
  is_deleted?: number;
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readWebArray<T>(key: string): T[] {
  const storage = (globalThis as any).localStorage;

  if (!storage) return [];

  const raw = storage.getItem(key);

  if (!raw) return [];

  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeWebArray<T>(key: string, data: T[]) {
  const storage = (globalThis as any).localStorage;

  if (!storage) return;

  storage.setItem(key, JSON.stringify(data));
}

async function ensureSyncQueueTable() {
  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      local_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );
  `);

  return db;
}

async function getCurrentCloudContext() {
  const userResult = await supabase.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    throw new Error("No Supabase user session found. Login again.");
  }

  const userId = userResult.data.user.id;

  const businessResult = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (businessResult.error) {
    throw new Error(businessResult.error.message);
  }

  if (!businessResult.data) {
    throw new Error("No cloud business found for this user.");
  }

  const storeResult = await supabase
    .from("stores")
    .select("id")
    .eq("business_id", businessResult.data.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (storeResult.error) {
    throw new Error(storeResult.error.message);
  }

  if (!storeResult.data) {
    throw new Error("No active cloud store found for this business.");
  }

  return {
    businessId: businessResult.data.id,
    storeId: storeResult.data.id,
  };
}

async function readLocalProduct(localId: string): Promise<LocalProduct | null> {
  if (Platform.OS === "web") {
    const products = readWebArray<LocalProduct>(WEB_PRODUCTS_KEY);
    return products.find((product) => product.id === localId) ?? null;
  }

  const db = await getDatabase();

  if (!db) return null;

  const row = await db.getFirstAsync<LocalProduct>(
    `SELECT * FROM products WHERE id = ? LIMIT 1;`,
    [localId]
  );

  return row ?? null;
}

async function readLocalCustomer(localId: string): Promise<LocalCustomer | null> {
  if (Platform.OS === "web") {
    const customers = readWebArray<LocalCustomer>(WEB_CUSTOMERS_KEY);
    return customers.find((customer) => customer.id === localId) ?? null;
  }

  const db = await getDatabase();

  if (!db) return null;

  const row = await db.getFirstAsync<LocalCustomer>(
    `SELECT * FROM customers WHERE id = ? LIMIT 1;`,
    [localId]
  );

  return row ?? null;
}

function buildProductPayload(
  product: LocalProduct | null,
  operation: SyncOperation
) {
  if (operation === "delete") {
    return {
      is_deleted: true,
    };
  }

  if (!product) {
    throw new Error("Product not found for sync queue.");
  }

  return {
    name: product.name,
    sku: product.sku ?? null,
    unit: product.unit ?? "pcs",
    cost_price: Number(product.cost_price ?? 0),
    selling_price: Number(product.selling_price ?? 0),
    stock_quantity: Number(product.stock_quantity ?? 0),
    is_deleted: Number(product.is_deleted ?? 0) === 1,
  };
}

function buildCustomerPayload(
  customer: LocalCustomer | null,
  operation: SyncOperation
) {
  if (operation === "delete") {
    return {
      is_deleted: true,
    };
  }

  if (!customer) {
    throw new Error("Customer not found for sync queue.");
  }

  return {
    name: customer.name,
    phone: customer.phone ?? null,
    address: customer.address ?? null,
    opening_balance: Number(customer.opening_balance ?? 0),
    current_balance: Number(customer.current_balance ?? 0),
    credit_limit: Number(customer.credit_limit ?? 0),
    is_deleted: Number(customer.is_deleted ?? 0) === 1,
  };
}

async function addToSyncQueue(
  entityType: SyncEntityType,
  operation: SyncOperation,
  localId: string,
  payload: Record<string, unknown>
) {
  const item: SyncQueueItem = {
    id: generateId("sync"),
    entity_type: entityType,
    operation,
    local_id: localId,
    payload: JSON.stringify(payload),
    status: "pending",
    error_message: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    synced_at: null,
  };

  if (Platform.OS === "web") {
    const queue = readWebArray<SyncQueueItem>(WEB_SYNC_QUEUE_KEY);

    const cleanedQueue = queue.filter(
      (queueItem) =>
        !(
          queueItem.entity_type === entityType &&
          queueItem.local_id === localId &&
          queueItem.status !== "synced"
        )
    );

    cleanedQueue.push(item);

    writeWebArray(WEB_SYNC_QUEUE_KEY, cleanedQueue);
    return;
  }

  const db = await ensureSyncQueueTable();

  await db.runAsync(
    `
      DELETE FROM sync_queue
      WHERE entity_type = ?
        AND local_id = ?
        AND status != 'synced';
    `,
    [entityType, localId]
  );

  await db.runAsync(
    `
      INSERT INTO sync_queue (
        id,
        entity_type,
        operation,
        local_id,
        payload,
        status,
        error_message,
        created_at,
        updated_at,
        synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      item.id,
      item.entity_type,
      item.operation,
      item.local_id,
      item.payload,
      item.status,
      item.error_message,
      item.created_at,
      item.updated_at,
      item.synced_at,
    ]
  );
}

export async function addProductToSyncQueue(
  productId: string,
  operation: SyncOperation = "upsert"
) {
  const product = await readLocalProduct(productId);
  const payload = buildProductPayload(product, operation);

  await addToSyncQueue("product", operation, productId, payload);
}

export async function addCustomerToSyncQueue(
  customerId: string,
  operation: SyncOperation = "upsert"
) {
  const customer = await readLocalCustomer(customerId);
  const payload = buildCustomerPayload(customer, operation);

  await addToSyncQueue("customer", operation, customerId, payload);
}

export async function buildProductsAndCustomersSyncQueue() {
  let productCount = 0;
  let customerCount = 0;

  if (Platform.OS === "web") {
    const products = readWebArray<LocalProduct>(WEB_PRODUCTS_KEY);
    const customers = readWebArray<LocalCustomer>(WEB_CUSTOMERS_KEY);

    for (const product of products) {
      if (Number(product.is_deleted ?? 0) === 1) continue;

      await addProductToSyncQueue(product.id, "upsert");
      productCount += 1;
    }

    for (const customer of customers) {
      if (Number(customer.is_deleted ?? 0) === 1) continue;

      await addCustomerToSyncQueue(customer.id, "upsert");
      customerCount += 1;
    }

    return {
      products: productCount,
      customers: customerCount,
    };
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const products = await db.getAllAsync<LocalProduct>(
    `SELECT * FROM products WHERE is_deleted = 0;`
  );

  const customers = await db.getAllAsync<LocalCustomer>(
    `SELECT * FROM customers WHERE is_deleted = 0;`
  );

  for (const product of products) {
    await addProductToSyncQueue(product.id, "upsert");
    productCount += 1;
  }

  for (const customer of customers) {
    await addCustomerToSyncQueue(customer.id, "upsert");
    customerCount += 1;
  }

  return {
    products: productCount,
    customers: customerCount,
  };
}

export async function getSyncQueueStats(): Promise<SyncQueueStats> {
  if (Platform.OS === "web") {
    const queue = readWebArray<SyncQueueItem>(WEB_SYNC_QUEUE_KEY);
    const syncedItems = queue.filter((item) => item.status === "synced");
    const lastSyncedAt = syncedItems.reduce<string | null>((latest, item) => {
      if (!item.synced_at) {
        return latest;
      }
      return latest && latest > item.synced_at ? latest : item.synced_at;
    }, null);

    return {
      pending: queue.filter((item) => item.status === "pending").length,
      synced: syncedItems.length,
      failed: queue.filter((item) => item.status === "failed").length,
      total: queue.length,
      lastSyncedAt,
    };
  }

  const db = await ensureSyncQueueTable();

  const rows = await db.getAllAsync<{ status: SyncStatus; count: number }>(
    `
      SELECT status, COUNT(*) as count
      FROM sync_queue
      GROUP BY status;
    `
  );

  const stats: SyncQueueStats = {
    pending: 0,
    synced: 0,
    failed: 0,
    total: 0,
    lastSyncedAt: null,
  };

  for (const row of rows) {
    stats[row.status] = Number(row.count);
    stats.total += Number(row.count);
  }

  const lastSyncedRow = await db.getFirstAsync<{ last_synced_at: string }>(
    `
      SELECT MAX(synced_at) AS last_synced_at
      FROM sync_queue
      WHERE synced_at IS NOT NULL;
    `
  );

  if (lastSyncedRow?.last_synced_at) {
    stats.lastSyncedAt = lastSyncedRow.last_synced_at;
  }

  return stats;
}

export const getSyncQueueStatus = getSyncQueueStats;

async function getItemsForPush(includeFailed: boolean): Promise<SyncQueueItem[]> {
  if (Platform.OS === "web") {
    const queue = readWebArray<SyncQueueItem>(WEB_SYNC_QUEUE_KEY);

    return queue.filter((item) =>
      includeFailed
        ? item.status === "pending" || item.status === "failed"
        : item.status === "pending"
    );
  }

  const db = await ensureSyncQueueTable();

  if (includeFailed) {
    return db.getAllAsync<SyncQueueItem>(
      `
        SELECT *
        FROM sync_queue
        WHERE status IN ('pending', 'failed')
        ORDER BY created_at ASC;
      `
    );
  }

  return db.getAllAsync<SyncQueueItem>(
    `
      SELECT *
      FROM sync_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC;
    `
  );
}

async function markQueueItemSynced(id: string) {
  if (Platform.OS === "web") {
    const queue = readWebArray<SyncQueueItem>(WEB_SYNC_QUEUE_KEY);

    const nextQueue = queue.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "synced" as SyncStatus,
            error_message: null,
            updated_at: nowIso(),
            synced_at: nowIso(),
          }
        : item
    );

    writeWebArray(WEB_SYNC_QUEUE_KEY, nextQueue);
    return;
  }

  const db = await ensureSyncQueueTable();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET status = 'synced',
          error_message = NULL,
          updated_at = ?,
          synced_at = ?
      WHERE id = ?;
    `,
    [nowIso(), nowIso(), id]
  );
}

async function markQueueItemFailed(id: string, errorMessage: string) {
  if (Platform.OS === "web") {
    const queue = readWebArray<SyncQueueItem>(WEB_SYNC_QUEUE_KEY);

    const nextQueue = queue.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "failed" as SyncStatus,
            error_message: errorMessage,
            updated_at: nowIso(),
          }
        : item
    );

    writeWebArray(WEB_SYNC_QUEUE_KEY, nextQueue);
    return;
  }

  const db = await ensureSyncQueueTable();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET status = 'failed',
          error_message = ?,
          updated_at = ?
      WHERE id = ?;
    `,
    [errorMessage, nowIso(), id]
  );
}

async function syncOneQueueItem(
  item: SyncQueueItem,
  businessId: string,
  storeId: string
) {
  const payload = JSON.parse(item.payload || "{}");

  if (item.entity_type === "product") {
    if (item.operation === "delete") {
      const result = await supabase
        .from("products")
        .update({
          is_deleted: true,
          updated_at: nowIso(),
        })
        .eq("business_id", businessId)
        .eq("local_id", item.local_id);

      if (result.error) {
        throw new Error(result.error.message);
      }

      return;
    }

    const result = await supabase.from("products").upsert(
      {
        business_id: businessId,
        store_id: storeId,
        local_id: item.local_id,
        name: payload.name,
        sku: payload.sku,
        unit: payload.unit ?? "pcs",
        cost_price: payload.cost_price ?? 0,
        selling_price: payload.selling_price ?? 0,
        stock_quantity: payload.stock_quantity ?? 0,
        is_deleted: payload.is_deleted ?? false,
        updated_at: nowIso(),
      },
      {
        onConflict: "business_id,local_id",
      }
    );

    if (result.error) {
      throw new Error(result.error.message);
    }

    return;
  }

  if (item.entity_type === "customer") {
    if (item.operation === "delete") {
      const result = await supabase
        .from("customers")
        .update({
          is_deleted: true,
          updated_at: nowIso(),
        })
        .eq("business_id", businessId)
        .eq("local_id", item.local_id);

      if (result.error) {
        throw new Error(result.error.message);
      }

      return;
    }

    const result = await supabase.from("customers").upsert(
      {
        business_id: businessId,
        local_id: item.local_id,
        name: payload.name,
        phone: payload.phone,
        address: payload.address,
        opening_balance: payload.opening_balance ?? 0,
        current_balance: payload.current_balance ?? 0,
        credit_limit: payload.credit_limit ?? 0,
        is_deleted: payload.is_deleted ?? false,
        updated_at: nowIso(),
      },
      {
        onConflict: "business_id,local_id",
      }
    );

    if (result.error) {
      throw new Error(result.error.message);
    }
  }
}

export async function pushProductsAndCustomersToCloud(includeFailed = false) {
  const context = await getCurrentCloudContext();
  const items = await getItemsForPush(includeFailed);

  let pushed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await syncOneQueueItem(item, context.businessId, context.storeId);
      await markQueueItemSynced(item.id);
      pushed += 1;
    } catch (error) {
      failed += 1;

      await markQueueItemFailed(
        item.id,
        error instanceof Error ? error.message : "Unknown sync error."
      );
    }
  }

  return {
    pushed,
    failed,
  };
}

export async function retryPendingSyncQueue() {
  return pushProductsAndCustomersToCloud(true);
}