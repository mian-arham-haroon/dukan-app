import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";

import { getDatabase } from "../database/database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "../database/seed";
import { getUserBusinessContext } from "./businessCloudService";
import { supabase } from "./supabase";
import type { Customer } from "../types/customer";
import type { Product } from "../types/product";

const WEB_PRODUCTS_KEY = "dukan_app_web_products";
const WEB_CUSTOMERS_KEY = "dukan_app_web_customers";

type CloudProductRow = {
  local_id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  cost_price: number | string | null;
  selling_price: number | string | null;
  stock_quantity: number | string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type CloudCustomerRow = {
  local_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  opening_balance: number | string | null;
  current_balance: number | string | null;
  credit_limit: number | string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type CloudRestoreResult = {
  productsPulled: number;
  customersPulled: number;
  message: string;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isLocalMoreRecent(
  localUpdatedAt: string | null | undefined,
  cloudUpdatedAt: string | null | undefined
) {
  if (!localUpdatedAt || !cloudUpdatedAt) {
    return false;
  }

  const localDate = new Date(localUpdatedAt).getTime();
  const cloudDate = new Date(cloudUpdatedAt).getTime();

  return !Number.isNaN(localDate) && !Number.isNaN(cloudDate) && localDate > cloudDate;
}

function mergeByIdWithTimestamp<T extends { id: string; updated_at?: string }>(
  cloudRows: T[],
  localRows: T[]
): T[] {
  return [
    ...cloudRows.map((cloudRow) => {
      const localRow = localRows.find((row) => row.id === cloudRow.id);
      if (!localRow) {
        return cloudRow;
      }
      if (isLocalMoreRecent(localRow.updated_at, cloudRow.updated_at)) {
        return localRow;
      }
      return cloudRow;
    }),
    ...localRows.filter(
      (row) => !cloudRows.some((cloudRow) => cloudRow.id === row.id)
    ),
  ];
}

function readWebArray<T>(key: string): T[] {
  const storage = (globalThis as any).localStorage;

  if (!storage) {
    return [];
  }

  const raw = storage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeWebArray<T>(key: string, data: T[]) {
  const storage = (globalThis as any).localStorage;

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(data));
}

function mapCloudProduct(row: CloudProductRow): Product {
  return {
    id: row.local_id,
    business_id: DEFAULT_BUSINESS_ID,
    store_id: DEFAULT_STORE_ID,
    name: row.name,
    sku: row.sku ?? "",
    barcode: null,
    category: "uncategorized",
    unit: row.unit ?? "pcs",
    cost_price: asNumber(row.cost_price),
    selling_price: asNumber(row.selling_price),
    stock_quantity: asNumber(row.stock_quantity),
    low_stock_threshold: 0,
    low_stock_alert: 5,
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
    sync_status: "synced",
    is_deleted: row.is_deleted ? 1 : 0,
  };
}

function mapCloudCustomer(row: CloudCustomerRow): Customer {
  return {
    id: row.local_id,
    business_id: DEFAULT_BUSINESS_ID,
    name: row.name,
    phone: row.phone ?? "",
    address: row.address ?? "",
    opening_balance: asNumber(row.opening_balance),
    current_balance: asNumber(row.current_balance),
    credit_limit: asNumber(row.credit_limit),
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
    sync_status: "synced",
    is_deleted: row.is_deleted ? 1 : 0,
  } as Customer;
}

export async function pullProductsAndCustomersFromCloud(
  user: User
): Promise<CloudRestoreResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  const { data: cloudProducts, error: productsError } = await supabase
    .from("products")
    .select(
      "local_id, name, sku, unit, cost_price, selling_price, stock_quantity, is_deleted, created_at, updated_at"
    )
    .eq("business_id", context.business.id);

  if (productsError) {
    throw productsError;
  }

  const { data: cloudCustomers, error: customersError } = await supabase
    .from("customers")
    .select(
      "local_id, name, phone, address, opening_balance, current_balance, credit_limit, is_deleted, created_at, updated_at"
    )
    .eq("business_id", context.business.id);

  if (customersError) {
    throw customersError;
  }

  const products = ((cloudProducts ?? []) as CloudProductRow[]).map(
    mapCloudProduct
  );

  const customers = ((cloudCustomers ?? []) as CloudCustomerRow[]).map(
    mapCloudCustomer
  );

  if (Platform.OS === "web") {
    const existingProducts = readWebArray<Product>(WEB_PRODUCTS_KEY);
    const existingCustomers = readWebArray<Customer>(WEB_CUSTOMERS_KEY);

    writeWebArray(WEB_PRODUCTS_KEY, mergeByIdWithTimestamp(products, existingProducts));
    writeWebArray(WEB_CUSTOMERS_KEY, mergeByIdWithTimestamp(customers, existingCustomers));

    return {
      productsPulled: products.filter((product) => product.is_deleted === 0)
        .length,
      customersPulled: customers.filter((customer) => customer.is_deleted === 0)
        .length,
      message: `Cloud restore complete. Products: ${
        products.filter((product) => product.is_deleted === 0).length
      }, Customers: ${
        customers.filter((customer) => customer.is_deleted === 0).length
      }.`,
    };
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await db.execAsync("BEGIN TRANSACTION;");

  try {
    for (const product of products) {
      const existing = await db.getFirstAsync<{ updated_at: string }>(
        `SELECT updated_at FROM products WHERE id = ? AND business_id = ? LIMIT 1;`,
        [product.id, DEFAULT_BUSINESS_ID]
      );

      if (
        existing &&
        isLocalMoreRecent(existing.updated_at, product.updated_at)
      ) {
        continue;
      }

      await db.runAsync(
        `
        INSERT OR REPLACE INTO products (
          id,
          business_id,
          store_id,
          name,
          sku,
          unit,
          cost_price,
          selling_price,
          stock_quantity,
          low_stock_alert,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          product.id,
          product.business_id,
          product.store_id,
          product.name,
          product.sku,
          product.unit,
          product.cost_price,
          product.selling_price,
          product.stock_quantity,
          product.low_stock_alert ?? 0,
          product.created_at,
          product.updated_at,
          product.sync_status,
          product.is_deleted,
        ]
      );
    }

    for (const customer of customers) {
      const existing = await db.getFirstAsync<{ updated_at: string }>(
        `SELECT updated_at FROM customers WHERE id = ? AND business_id = ? LIMIT 1;`,
        [customer.id, DEFAULT_BUSINESS_ID]
      );

      if (
        existing &&
        isLocalMoreRecent(existing.updated_at, customer.updated_at)
      ) {
        continue;
      }

      await db.runAsync(
        `
        INSERT OR REPLACE INTO customers (
          id,
          business_id,
          name,
          phone,
          address,
          opening_balance,
          current_balance,
          credit_limit,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          customer.id,
          customer.business_id,
          customer.name,
          customer.phone,
          customer.address,
          customer.opening_balance,
          customer.current_balance,
          customer.credit_limit,
          customer.created_at,
          customer.updated_at,
          customer.sync_status,
          customer.is_deleted,
        ]
      );
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }

  return {
    productsPulled: products.filter((product) => product.is_deleted === 0)
      .length,
    customersPulled: customers.filter((customer) => customer.is_deleted === 0)
      .length,
    message: `Cloud restore complete. Products: ${
      products.filter((product) => product.is_deleted === 0).length
    }, Customers: ${
      customers.filter((customer) => customer.is_deleted === 0).length
    }.`,
  };
}