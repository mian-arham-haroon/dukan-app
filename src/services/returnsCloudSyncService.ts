import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";

import { getDatabase } from "../database/database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "../database/seed";
import { getInvoices } from "../database/invoicesRepository";
import {
  ensureReturnsTable,
  getInvoiceReturnsForSync,
} from "../database/returnsRepository";
import { getUserBusinessContext } from "./businessCloudService";
import { supabase } from "./supabase";

type PushReturnsResult = {
  returnRecordsPushed: number;
  message: string;
};

const WEB_RETURNS_KEY = "dukan_app_web_invoice_returns";

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

function mergeById<T extends { id: string; updated_at?: string }>(
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

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getNumericField(item: any, fieldNames: string[]): number {
  for (const name of fieldNames) {
    if (item[name] != null) {
      return asNumber(item[name]);
    }
  }

  return 0;
}

function getStringField(item: any, fieldNames: string[], fallback: string | null = ""): string | null {
  for (const name of fieldNames) {
    if (item[name] != null) {
      return String(item[name]);
    }
  }

  return fallback;
}

export async function pushInvoiceReturnsToCloud(
  user: User
): Promise<PushReturnsResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  if (!context.store) {
    throw new Error("Cloud store not found. Setup store first.");
  }

  const business = context.business;
  const store = context.store;

  const invoiceReturns = await getInvoiceReturnsForSync();

  if (invoiceReturns.length === 0) {
    return {
      returnRecordsPushed: 0,
      message: "No invoice return records found to push.",
    };
  }

  const invoices = await getInvoices();
  const invoiceMap = new Map<string, any>();
  for (const invoice of invoices) {
    invoiceMap.set(String(invoice.id), invoice);
  }

  const returnRows = invoiceReturns.map((item: any) => {
    const invoice = invoiceMap.get(String(item.invoice_id));
    const customerLocalId = getStringField(invoice ?? {}, ["customer_id", "customer_local_id"], null) || null;
    const customerName = getStringField(invoice ?? {}, ["customer_name", "customerName"], "Walk-in") || "Walk-in";
    const invoiceNo = getStringField(invoice ?? {}, ["invoice_no", "invoiceNo"], "");

    return {
      business_id: business.id,
      store_id: store.id,
      local_id: String(item.id),
      invoice_local_id: item.invoice_id,
      invoice_no: invoiceNo,
      invoice_item_local_id: item.invoice_item_local_id ?? null,
      customer_local_id: customerLocalId,
      customer_name: customerName,
      product_local_id: item.product_id ? String(item.product_id) : null,
      product_name: getStringField(item, ["product_name", "productName"], "Item"),
      returned_quantity: getNumericField(item, ["returned_quantity", "quantity", "return_quantity", "qty"]),
      unit_price: getNumericField(item, ["unit_price", "unitPrice"]),
      refund_amount: getNumericField(item, ["refund_amount", "return_total", "total", "amount", "line_total"]),
      udhaar_reduced: getNumericField(item, ["udhaar_reduced", "udhaarReduced", "balance_reduced"]),
      cash_refund: getNumericField(item, ["cash_refund", "cashRefund", "refund_cash"]),
      note: item.note ?? null,
      returned_at: item.created_at ?? new Date().toISOString(),
      updated_at: item.updated_at ?? item.created_at ?? new Date().toISOString(),
      is_deleted: Number(item.is_deleted ?? 0) === 1,
    };
  });

  console.log("RETURN SYNC PAYLOAD", returnRows);

  const { error } = await supabase.from("invoice_returns").upsert(returnRows, {
    onConflict: "business_id,local_id",
  });

  if (error) {
    throw error;
  }

  return {
    returnRecordsPushed: returnRows.length,
    message: `Returns pushed to cloud. Records: ${returnRows.length}.`,
  };
}

export async function pullReturnsFromCloud(
  user: User,
  useTransaction = true
): Promise<{ returnsPulled: number; message: string }> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  const businessId = context.business.id;

  const result = await supabase
    .from("invoice_returns")
    .select("*")
    .eq("business_id", businessId);

  if (result.error) throw result.error;

  const returnRecords = result.data ?? [];

  if (returnRecords.length === 0) {
    return {
      returnsPulled: 0,
      message: "No returns found in Supabase.",
    };
  }

  const importedReturns = returnRecords.map((item: any) => {
    const createdAt = item.returned_at ?? item.created_at ?? new Date().toISOString();
    const updatedAt = item.updated_at ?? createdAt;
    const quantity = asNumber(item.quantity);
    const unitPrice = asNumber(item.unit_price);
    const refundAmount = asNumber(item.refund_amount ?? item.line_total);
    const calculatedQuantity =
      quantity > 0
        ? quantity
        : unitPrice > 0
        ? Number((refundAmount / unitPrice).toFixed(6))
        : 0;
    const finalQuantity = quantity > 0 ? quantity : calculatedQuantity;
    const finalLineTotal =
      asNumber(item.refund_amount ?? item.line_total) ||
      Number((finalQuantity * unitPrice).toFixed(2));

    return {
      id: String(item.local_id),
      business_id: DEFAULT_BUSINESS_ID,
      store_id: DEFAULT_STORE_ID,
      invoice_id: String(item.invoice_local_id),
      invoice_item_local_id: item.invoice_item_local_id ?? null,
      product_id: item.product_local_id ?? null,
      product_name: item.product_name ?? "Item",
      quantity: finalQuantity,
      unit_price: unitPrice,
      line_total: finalLineTotal,
      balance_reduced: asNumber(item.udhaar_reduced),
      cash_refund: asNumber(item.cash_refund),
      note: item.note ?? null,
      created_at: createdAt,
      updated_at: updatedAt,
      sync_status: "synced",
      is_deleted: Number(item.is_deleted ?? 0),
    };
  });

  if (Platform.OS === "web") {
    const existingReturns = readWebArray<any>(WEB_RETURNS_KEY);
    writeWebArray(WEB_RETURNS_KEY, mergeById(importedReturns, existingReturns));

    return {
      returnsPulled: importedReturns.length,
      message: `Returns restored on web. Count: ${importedReturns.length}.`,
    };
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await ensureReturnsTable();

  if (useTransaction) {
    await db.execAsync("BEGIN TRANSACTION;");
  }

  let updatedCount = 0;

  try {
    for (const returnRow of importedReturns) {
      const existingRow = await db.getFirstAsync<{ updated_at: string }>(
        `SELECT updated_at FROM invoice_returns WHERE id = ?;`,
        [returnRow.id]
      );

      if (
        existingRow &&
        isLocalMoreRecent(existingRow.updated_at, returnRow.updated_at)
      ) {
        continue;
      }

      await db.runAsync(
        `
        INSERT OR REPLACE INTO invoice_returns (
          id,
          business_id,
          store_id,
          invoice_id,
          invoice_item_local_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          line_total,
          balance_reduced,
          cash_refund,
          note,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          returnRow.id,
          returnRow.business_id,
          returnRow.store_id,
          returnRow.invoice_id,
          returnRow.invoice_item_local_id,
          returnRow.product_id,
          returnRow.product_name,
          returnRow.quantity,
          returnRow.unit_price,
          returnRow.line_total,
          returnRow.balance_reduced,
          returnRow.cash_refund,
          returnRow.note,
          returnRow.created_at,
          returnRow.updated_at,
          returnRow.sync_status,
          returnRow.is_deleted,
        ]
      );

      updatedCount += 1;
    }

    if (useTransaction) {
      await db.execAsync("COMMIT;");
    }
  } catch (error) {
    if (useTransaction) {
      await db.execAsync("ROLLBACK;");
    }
    throw error;
  }

  return {
    returnsPulled: updatedCount,
    message: `Returns restored to local database. Applied: ${updatedCount}, available: ${importedReturns.length}.`,
  };
}
