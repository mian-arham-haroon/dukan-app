import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";

import { getDatabase } from "../database/database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "../database/seed";
import { getUserBusinessContext } from "./businessCloudService";
import { pullProductsAndCustomersFromCloud } from "./cloudRestoreService";
import { pullReturnsFromCloud } from "./returnsCloudSyncService";
import { supabase } from "./supabase";

const WEB_INVOICES_KEY = "dukan_app_web_invoices";
const WEB_INVOICE_ITEMS_KEY = "dukan_app_web_invoice_items";
const WEB_PAYMENTS_KEY = "dukan_app_web_payments";
const WEB_CASHBOOK_KEY = "dukan_app_web_cashbook_entries";
const WEB_DAILY_CLOSES_KEY = "dukan_app_web_daily_closes";

type RestoreSalesDataResult = {
  invoicesPulled: number;
  invoiceItemsPulled: number;
  paymentsPulled: number;
  cashbookPulled: number;
  dailyClosesPulled: number;
  returnsPulled: number;
  message: string;
};

type FullSalesDataRestoreResult = RestoreSalesDataResult & {
  productsPulled: number;
  customersPulled: number;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
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

function mergeById<T extends { id: string }>(cloudRows: T[], localRows: T[]): T[] {
  const cloudIds = new Set(cloudRows.map((row) => row.id));
  return [...cloudRows, ...localRows.filter((row) => !cloudIds.has(row.id))];
}

export async function pullSalesDataFromCloud(
  user: User
): Promise<RestoreSalesDataResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  const businessId = context.business.id;

  const [
    invoicesResult,
    invoiceItemsResult,
    paymentsResult,
    cashbookResult,
    dailyClosesResult,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_deleted", false),

    supabase
      .from("invoice_items")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_deleted", false),

    supabase
      .from("payments")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_deleted", false),

    supabase
      .from("cashbook_entries")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_deleted", false),

    supabase
      .from("daily_closes")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_deleted", false),
  ]);

  if (invoicesResult.error) throw invoicesResult.error;
  if (invoiceItemsResult.error) throw invoiceItemsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (cashbookResult.error) throw cashbookResult.error;
  if (dailyClosesResult.error) throw dailyClosesResult.error;

  const invoices = (invoicesResult.data ?? []).map((row: any) => ({
    id: String(row.local_id),
    business_id: DEFAULT_BUSINESS_ID,
    store_id: DEFAULT_STORE_ID,
    customer_id: row.customer_local_id ?? null,
    invoice_no: row.invoice_no,
    status: row.status ?? "posted",
    payment_status:
      row.status === "void" ? "void" : row.payment_status,
    subtotal: asNumber(row.grand_total),
    discount_total: 0,
    tax_total: 0,
    grand_total: asNumber(row.grand_total),
    paid_amount: asNumber(row.paid_amount),
    balance_due:
      row.status === "void" ? 0 : asNumber(row.balance_due),
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
    sync_status: "synced",
    is_deleted: 0,
    customer_name: row.customer_name ?? "Walk-in",
    item_summary: row.item_summary ?? "",
    item_count: asNumber(row.item_count),
  }));

  const invoiceItems = (invoiceItemsResult.data ?? []).map((row: any) => ({
    id: String(row.local_id),
    invoice_id: String(row.invoice_local_id),
    product_id: row.product_local_id ?? null,
    product_name_snapshot: row.product_name,
    quantity: asNumber(row.quantity),
    unit_price: asNumber(row.unit_price),
    cost_price: asNumber(row.cost_price),
    discount_amount: asNumber(row.discount_amount),
    line_total: asNumber(row.line_total),
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
    sync_status: "synced",
    is_deleted: 0,
  }));

  const payments = (paymentsResult.data ?? []).map((row: any) => ({
    id: String(row.local_id),
    business_id: DEFAULT_BUSINESS_ID,
    invoice_id: row.invoice_local_id ?? null,
    customer_id: row.customer_local_id ?? null,
    amount: asNumber(row.amount),
    method: row.method ?? "cash",
    direction: row.direction ?? "in",
    paid_at: row.paid_at ?? nowIso(),
    note: row.note ?? null,
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
    sync_status: "synced",
    is_deleted: 0,
  }));

  const cashbookEntries = (cashbookResult.data ?? []).map((row: any) => ({
    id: String(row.local_id),
    business_id: DEFAULT_BUSINESS_ID,
    store_id: DEFAULT_STORE_ID,
    entry_type: row.entry_type,
    amount_in: asNumber(row.amount_in),
    amount_out: asNumber(row.amount_out),
    description: row.description ?? "",
    ref_type: row.ref_type ?? null,
    ref_id: row.ref_local_id ?? null,
    entry_at: row.entry_at ?? nowIso(),
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
    sync_status: "synced",
    is_deleted: 0,
  }));

  const dailyCloses = (dailyClosesResult.data ?? []).map((row: any) => ({
    id: String(row.local_id),
    business_id: DEFAULT_BUSINESS_ID,
    store_id: DEFAULT_STORE_ID,
    expected_cash: asNumber(row.expected_cash),
    actual_cash: asNumber(row.actual_cash),
    difference: asNumber(row.difference),
    note: row.note ?? null,
    closed_at: row.closed_at ?? nowIso(),
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
    sync_status: "synced",
    is_deleted: 0,
  }));

  if (Platform.OS === "web") {
    writeWebArray(
      WEB_INVOICES_KEY,
      mergeById(invoices, readWebArray<any>(WEB_INVOICES_KEY))
    );

    writeWebArray(
      WEB_INVOICE_ITEMS_KEY,
      mergeById(invoiceItems, readWebArray<any>(WEB_INVOICE_ITEMS_KEY))
    );

    writeWebArray(
      WEB_PAYMENTS_KEY,
      mergeById(payments, readWebArray<any>(WEB_PAYMENTS_KEY))
    );

    writeWebArray(
      WEB_CASHBOOK_KEY,
      mergeById(cashbookEntries, readWebArray<any>(WEB_CASHBOOK_KEY))
    );

    const returnsResult = await pullReturnsFromCloud(user);

    writeWebArray(
      WEB_DAILY_CLOSES_KEY,
      mergeById(dailyCloses, readWebArray<any>(WEB_DAILY_CLOSES_KEY))
    );

    return {
      invoicesPulled: invoices.length,
      invoiceItemsPulled: invoiceItems.length,
      paymentsPulled: payments.length,
      cashbookPulled: cashbookEntries.length,
      dailyClosesPulled: dailyCloses.length,
      returnsPulled: returnsResult.returnsPulled,
      message: `Sales restore complete. Invoices: ${invoices.length}, Items: ${invoiceItems.length}, Payments: ${payments.length}, Cashbook: ${cashbookEntries.length}, Daily closes: ${dailyCloses.length}, Returns: ${returnsResult.returnsPulled}.`,
    };
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  let returnsResult = { returnsPulled: 0, message: "" };

  await db.execAsync("BEGIN TRANSACTION;");

  try {
    for (const invoice of invoices) {
      await db.runAsync(
        `
        INSERT OR REPLACE INTO invoices (
          id,
          business_id,
          store_id,
          customer_id,
          invoice_no,
          status,
          payment_status,
          subtotal,
          discount_total,
          tax_total,
          grand_total,
          paid_amount,
          balance_due,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          invoice.id,
          invoice.business_id,
          invoice.store_id,
          invoice.customer_id,
          invoice.invoice_no,
          invoice.status,
          invoice.payment_status,
          invoice.subtotal,
          invoice.discount_total,
          invoice.tax_total,
          invoice.grand_total,
          invoice.paid_amount,
          invoice.balance_due,
          invoice.created_at,
          invoice.updated_at,
          invoice.sync_status,
          invoice.is_deleted,
        ]
      );
    }

    for (const item of invoiceItems) {
      await db.runAsync(
        `
        INSERT OR REPLACE INTO invoice_items (
          id,
          invoice_id,
          product_id,
          product_name_snapshot,
          quantity,
          unit_price,
          cost_price,
          discount_amount,
          line_total,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          item.id,
          item.invoice_id,
          item.product_id,
          item.product_name_snapshot,
          item.quantity,
          item.unit_price,
          item.cost_price,
          item.discount_amount,
          item.line_total,
          item.created_at,
          item.updated_at,
          item.sync_status,
          item.is_deleted,
        ]
      );
    }

    for (const payment of payments) {
      await db.runAsync(
        `
        INSERT OR REPLACE INTO payments (
          id,
          business_id,
          invoice_id,
          customer_id,
          amount,
          method,
          direction,
          paid_at,
          note,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          payment.id,
          payment.business_id,
          payment.invoice_id,
          payment.customer_id,
          payment.amount,
          payment.method,
          payment.direction,
          payment.paid_at,
          payment.note,
          payment.created_at,
          payment.updated_at,
          payment.sync_status,
          payment.is_deleted,
        ]
      );
    }

    for (const entry of cashbookEntries) {
      await db.runAsync(
        `
        INSERT OR REPLACE INTO cashbook_entries (
          id,
          business_id,
          store_id,
          entry_type,
          amount_in,
          amount_out,
          description,
          ref_type,
          ref_id,
          entry_at,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          entry.id,
          entry.business_id,
          entry.store_id,
          entry.entry_type,
          entry.amount_in,
          entry.amount_out,
          entry.description,
          entry.ref_type,
          entry.ref_id,
          entry.entry_at,
          entry.created_at,
          entry.updated_at,
          entry.sync_status,
          entry.is_deleted,
        ]
      );
    }

    returnsResult = await pullReturnsFromCloud(user, false);

    for (const close of dailyCloses) {
      await db.runAsync(
        `
        INSERT OR REPLACE INTO daily_closes (
          id,
          business_id,
          store_id,
          expected_cash,
          actual_cash,
          difference,
          note,
          closed_at,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          close.id,
          close.business_id,
          close.store_id,
          close.expected_cash,
          close.actual_cash,
          close.difference,
          close.note,
          close.closed_at,
          close.created_at,
          close.updated_at,
          close.sync_status,
          close.is_deleted,
        ]
      );
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }

  return {
    invoicesPulled: invoices.length,
    invoiceItemsPulled: invoiceItems.length,
    paymentsPulled: payments.length,
    cashbookPulled: cashbookEntries.length,
    dailyClosesPulled: dailyCloses.length,
    returnsPulled: returnsResult.returnsPulled,
    message: `Sales restore complete. Invoices: ${invoices.length}, Items: ${invoiceItems.length}, Payments: ${payments.length}, Cashbook: ${cashbookEntries.length}, Daily closes: ${dailyCloses.length}, Returns: ${returnsResult.returnsPulled}.`,
  };
}

export async function pullFullSalesDataFromCloud(
  user: User
): Promise<FullSalesDataRestoreResult> {
  const cloudData = await pullProductsAndCustomersFromCloud(user);
  const salesData = await pullSalesDataFromCloud(user);

  return {
    productsPulled: cloudData.productsPulled,
    customersPulled: cloudData.customersPulled,
    invoicesPulled: salesData.invoicesPulled,
    invoiceItemsPulled: salesData.invoiceItemsPulled,
    paymentsPulled: salesData.paymentsPulled,
    cashbookPulled: salesData.cashbookPulled,
    dailyClosesPulled: salesData.dailyClosesPulled,
    returnsPulled: salesData.returnsPulled,
    message: `Full cloud restore complete. Products: ${cloudData.productsPulled}, Customers: ${cloudData.customersPulled}, Invoices: ${salesData.invoicesPulled}, Items: ${salesData.invoiceItemsPulled}, Payments: ${salesData.paymentsPulled}, Cashbook: ${salesData.cashbookPulled}, Daily closes: ${salesData.dailyClosesPulled}, Returns: ${salesData.returnsPulled}.`,
  };
}
