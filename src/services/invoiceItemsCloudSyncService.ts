import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";

import { getDatabase } from "../database/database";
import { DEFAULT_BUSINESS_ID } from "../database/seed";
import { getUserBusinessContext } from "./businessCloudService";
import { supabase } from "./supabase";

const WEB_INVOICE_ITEMS_KEY = "dukan_app_web_invoice_items";

type LocalInvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

type PushInvoiceItemsResult = {
  itemsPushed: number;
  message: string;
};

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

async function getLocalInvoiceItems(): Promise<LocalInvoiceItem[]> {
  if (Platform.OS === "web") {
    return readWebArray<LocalInvoiceItem>(WEB_INVOICE_ITEMS_KEY);
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  return db.getAllAsync<LocalInvoiceItem>(
    `
    select
      invoice_items.id,
      invoice_items.invoice_id,
      invoice_items.product_id,
      invoice_items.product_name_snapshot,
      invoice_items.quantity,
      invoice_items.unit_price,
      invoice_items.cost_price,
      invoice_items.discount_amount,
      invoice_items.line_total,
      invoice_items.created_at,
      invoice_items.updated_at,
      invoice_items.is_deleted
    from invoice_items
    inner join invoices on invoices.id = invoice_items.invoice_id
    where invoices.business_id = ?
    order by invoice_items.created_at desc;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function pushInvoiceItemsToCloud(
  user: User
): Promise<PushInvoiceItemsResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  if (!context.store) {
    throw new Error("Cloud store not found. Setup store first.");
  }

  const items = await getLocalInvoiceItems();

  if (items.length === 0) {
    return {
      itemsPushed: 0,
      message:
        "No local invoice item rows found. Create a new invoice after invoice item storage is added.",
    };
  }

  const now = new Date().toISOString();

  const rows = items.map((item) => ({
    business_id: context.business!.id,
    store_id: context.store!.id,

    local_id: String(item.id),
    invoice_local_id: String(item.invoice_id),
    product_local_id: item.product_id ? String(item.product_id) : null,

    product_name: item.product_name_snapshot ?? "Item",
    quantity: asNumber(item.quantity),
    unit_price: asNumber(item.unit_price),
    cost_price: asNumber(item.cost_price),
    discount_amount: asNumber(item.discount_amount),
    line_total: asNumber(item.line_total),

    is_deleted: Number(item.is_deleted ?? 0) === 1,
    created_at: item.created_at ?? now,
    updated_at: item.updated_at ?? now,
  }));

  const { error } = await supabase.from("invoice_items").upsert(rows, {
    onConflict: "business_id,local_id",
  });

  if (error) {
    throw error;
  }

  return {
    itemsPushed: rows.length,
    message: `Invoice items pushed to cloud. Count: ${rows.length}.`,
  };
}