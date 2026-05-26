import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";

import { getDatabase } from "../database/database";
import { DEFAULT_BUSINESS_ID } from "../database/seed";
import { getUserBusinessContext } from "./businessCloudService";
import { pushInvoiceReturnsToCloud } from "./returnsCloudSyncService";
import { supabase } from "./supabase";

const WEB_PAYMENTS_KEY = "dukan_app_web_payments";
const WEB_CASHBOOK_KEY = "dukan_app_web_cashbook_entries";

type LocalPayment = {
  id: string;
  business_id: string;
  invoice_id: string | null;
  customer_id: string | null;
  amount: number;
  method: string;
  direction: "in" | "out";
  paid_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

type LocalCashbookEntry = {
  id: string;
  business_id: string;
  store_id: string;
  entry_type: string;
  amount_in: number;
  amount_out: number;
  description: string;
  ref_type: string | null;
  ref_id: string | null;
  entry_at: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

type PushPaymentsCashbookResult = {
  paymentsPushed: number;
  cashbookEntriesPushed: number;
  returnsPushed: number;
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

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function getLocalPayments(): Promise<LocalPayment[]> {
  if (Platform.OS === "web") {
    return readWebArray<LocalPayment>(WEB_PAYMENTS_KEY);
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  try {
    return await db.getAllAsync<LocalPayment>(
      `
      select
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
        is_deleted
      from payments
      where business_id = ?
      order by created_at desc;
      `,
      [DEFAULT_BUSINESS_ID]
    );
  } catch {
    return [];
  }
}

async function getLocalCashbookEntries(): Promise<LocalCashbookEntry[]> {
  if (Platform.OS === "web") {
    return readWebArray<LocalCashbookEntry>(WEB_CASHBOOK_KEY);
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  try {
    return await db.getAllAsync<LocalCashbookEntry>(
      `
      select
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
        is_deleted
      from cashbook_entries
      where business_id = ?
      order by entry_at desc;
      `,
      [DEFAULT_BUSINESS_ID]
    );
  } catch {
    return [];
  }
}

export async function pushPaymentsAndCashbookToCloud(
  user: User
): Promise<PushPaymentsCashbookResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  if (!context.store) {
    throw new Error("Cloud store not found. Setup store first.");
  }

  const [payments, cashbookEntries] = await Promise.all([
    getLocalPayments(),
    getLocalCashbookEntries(),
  ]);

  const now = new Date().toISOString();

  const paymentRows = payments.map((payment) => ({
    business_id: context.business!.id,
    store_id: context.store!.id,

    local_id: String(payment.id),
    invoice_local_id: payment.invoice_id ? String(payment.invoice_id) : null,
    customer_local_id: payment.customer_id ? String(payment.customer_id) : null,

    amount: asNumber(payment.amount),
    method: payment.method ?? "cash",
    direction: payment.direction ?? "in",
    paid_at: payment.paid_at ?? now,
    note: payment.note ?? null,

    is_deleted: Number(payment.is_deleted ?? 0) === 1,
    created_at: payment.created_at ?? now,
    updated_at: payment.updated_at ?? now,
  }));

  const cashbookRows = cashbookEntries.map((entry) => ({
    business_id: context.business!.id,
    store_id: context.store!.id,

    local_id: String(entry.id),
    entry_type: entry.entry_type,
    amount_in: asNumber(entry.amount_in),
    amount_out: asNumber(entry.amount_out),
    description: entry.description ?? "",
    ref_type: entry.ref_type ?? null,
    ref_local_id: entry.ref_id ? String(entry.ref_id) : null,
    entry_at: entry.entry_at ?? now,

    is_deleted: Number(entry.is_deleted ?? 0) === 1,
    created_at: entry.created_at ?? now,
    updated_at: entry.updated_at ?? now,
  }));

  if (paymentRows.length > 0) {
    const { error } = await supabase.from("payments").upsert(paymentRows, {
      onConflict: "business_id,local_id",
    });

    if (error) {
      throw error;
    }
  }

  if (cashbookRows.length > 0) {
    const { error } = await supabase
      .from("cashbook_entries")
      .upsert(cashbookRows, {
        onConflict: "business_id,local_id",
      });

    if (error) {
      throw error;
    }
  }

  const returnsResult = await pushInvoiceReturnsToCloud(user);

  return {
    paymentsPushed: paymentRows.length,
    cashbookEntriesPushed: cashbookRows.length,
    returnsPushed: returnsResult.returnRecordsPushed,
    message: `Payments pushed: ${paymentRows.length}. Cashbook entries pushed: ${cashbookRows.length}. Returns pushed: ${returnsResult.returnRecordsPushed}.`,
  };
}