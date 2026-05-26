import { Platform } from "react-native";

import { getDatabase } from "./database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "./seed";
import { addProductToSyncQueue } from "./syncQueueRepository";
import { runAutoSync } from "../services/autoSyncService";
import type { Product } from "../types/product";

const WEB_PRODUCTS_KEY = "dukan_app_web_products";

export type CreateProductInput = {
  name: string;
  sku?: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
};

export type UpdateProductInput = {
  name: string;
  sku?: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
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

function normalizeProductInput(input: CreateProductInput | UpdateProductInput) {
  const name = input.name.trim();
  const sku = input.sku?.trim() || "";
  const unit = input.unit?.trim() || "pcs";

  const costPrice = Number(input.costPrice || 0);
  const sellingPrice = Number(input.sellingPrice || 0);
  const stockQuantity = Number(input.stockQuantity || 0);

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (costPrice < 0) {
    throw new Error("Cost price cannot be negative.");
  }

  if (sellingPrice < 0) {
    throw new Error("Selling price cannot be negative.");
  }

  if (stockQuantity < 0) {
    throw new Error("Stock quantity cannot be negative.");
  }

  return {
    name,
    sku,
    unit,
    costPrice,
    sellingPrice,
    stockQuantity,
  };
}

export async function getProducts(): Promise<Product[]> {
  if (Platform.OS === "web") {
    return readWebArray<Product>(WEB_PRODUCTS_KEY)
      .filter((product) => Number(product.is_deleted ?? 0) === 0)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  return db.getAllAsync<Product>(
    `
    SELECT
      id,
      business_id,
      name,
      sku,
      barcode,
      category,
      unit,
      cost_price,
      selling_price,
      stock_quantity,
      low_stock_threshold,
      created_at,
      updated_at,
      sync_status,
      is_deleted
    FROM products
    WHERE business_id = ?
      AND is_deleted = 0
    ORDER BY created_at DESC;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}

export async function createProduct(
  input: CreateProductInput
): Promise<Product> {
  const normalized = normalizeProductInput(input);
  const timestamp = nowIso();

  const product: Product = {
    id: generateId("product"),
    business_id: DEFAULT_BUSINESS_ID,
    store_id: DEFAULT_STORE_ID,
    name: normalized.name,
    sku: normalized.sku || null,
    barcode: null,
    category: "general",
    unit: normalized.unit,
    cost_price: normalized.costPrice,
    selling_price: normalized.sellingPrice,
    stock_quantity: normalized.stockQuantity,
    low_stock_threshold: 5,
    created_at: timestamp,
    updated_at: timestamp,
    sync_status: "pending",
    is_deleted: 0,
  };

  if (Platform.OS === "web") {
    const products = readWebArray<Product>(WEB_PRODUCTS_KEY);
    writeWebArray(WEB_PRODUCTS_KEY, [product, ...products]);

    await addProductToSyncQueue(product.id, "upsert");
    void runAutoSync("product_created");

    return product;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await db.runAsync(
    `
    INSERT INTO products (
      id,
      business_id,
      name,
      sku,
      barcode,
      category,
      unit,
      cost_price,
      selling_price,
      stock_quantity,
      low_stock_threshold,
      created_at,
      updated_at,
      sync_status,
      is_deleted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      product.id,
      product.business_id,
      product.name,
      product.sku,
      product.barcode,
      product.category,
      product.unit,
      product.cost_price,
      product.selling_price,
      product.stock_quantity,
      product.low_stock_threshold,
      product.created_at,
      product.updated_at,
      product.sync_status,
      product.is_deleted,
    ]
  );

  await addProductToSyncQueue(product.id, "upsert");
  void runAutoSync("product_created");

  return product;
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput
): Promise<void> {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const normalized = normalizeProductInput(input);
  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const products = readWebArray<Product>(WEB_PRODUCTS_KEY);

    const exists = products.some(
      (product) =>
        product.id === productId && Number(product.is_deleted ?? 0) === 0
    );

    if (!exists) {
      throw new Error("Product was not found.");
    }

    const updatedProducts = products.map((product) =>
      product.id === productId
        ? ({
            ...product,
            name: normalized.name,
            sku: normalized.sku,
            unit: normalized.unit,
            cost_price: normalized.costPrice,
            selling_price: normalized.sellingPrice,
            stock_quantity: normalized.stockQuantity,
            updated_at: timestamp,
            sync_status: "pending",
          } as Product)
        : product
    );

    writeWebArray(WEB_PRODUCTS_KEY, updatedProducts);

    await addProductToSyncQueue(productId, "upsert");
    void runAutoSync("product_updated");

    return;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const existingProduct = await db.getFirstAsync<Product>(
    `
    SELECT *
    FROM products
    WHERE id = ?
      AND business_id = ?
      AND is_deleted = 0
    LIMIT 1;
    `,
    [productId, DEFAULT_BUSINESS_ID]
  );

  if (!existingProduct) {
    throw new Error("Product was not found.");
  }

  await db.runAsync(
    `
    UPDATE products
    SET name = ?,
        sku = ?,
        unit = ?,
        cost_price = ?,
        selling_price = ?,
        stock_quantity = ?,
        updated_at = ?,
        sync_status = 'pending'
    WHERE id = ?
      AND business_id = ?;
    `,
    [
      normalized.name,
      normalized.sku,
      normalized.unit,
      normalized.costPrice,
      normalized.sellingPrice,
      normalized.stockQuantity,
      timestamp,
      productId,
      DEFAULT_BUSINESS_ID,
    ]
  );

  await addProductToSyncQueue(productId, "upsert");
  void runAutoSync("product_updated");
}

export async function deleteProduct(productId: string): Promise<void> {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const products = readWebArray<Product>(WEB_PRODUCTS_KEY);

    const exists = products.some(
      (product) =>
        product.id === productId && Number(product.is_deleted ?? 0) === 0
    );

    if (!exists) {
      throw new Error("Product was not found.");
    }

    const updatedProducts = products.map((product) =>
      product.id === productId
        ? ({
            ...product,
            is_deleted: 1,
            updated_at: timestamp,
            sync_status: "pending",
          } as Product)
        : product
    );

    writeWebArray(WEB_PRODUCTS_KEY, updatedProducts);

    await addProductToSyncQueue(productId, "delete");
    void runAutoSync("product_deleted");

    return;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const existingProduct = await db.getFirstAsync<Product>(
    `
    SELECT *
    FROM products
    WHERE id = ?
      AND business_id = ?
      AND is_deleted = 0
    LIMIT 1;
    `,
    [productId, DEFAULT_BUSINESS_ID]
  );

  if (!existingProduct) {
    throw new Error("Product was not found.");
  }

  await db.runAsync(
    `
    UPDATE products
    SET is_deleted = 1,
        updated_at = ?,
        sync_status = 'pending'
    WHERE id = ?
      AND business_id = ?;
    `,
    [timestamp, productId, DEFAULT_BUSINESS_ID]
  );

  await addProductToSyncQueue(productId, "delete");
  void runAutoSync("product_deleted");
}

/**
 * Compatibility aliases.
 * Keep these so your screen does not break if it imports older names.
 */
export const addProduct = createProduct;
export const editProduct = updateProduct;