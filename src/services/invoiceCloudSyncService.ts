import type { User } from "@supabase/supabase-js";

import { getInvoicesForSync } from "../database/invoicesRepository";
import { getUserBusinessContext } from "./businessCloudService";
import { supabase } from "./supabase";

type InvoiceCloudPushResult = {
  invoicesPushed: number;
  message: string;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getInvoiceSummary(invoice: any): string {
  if (invoice.item_summary) {
    return String(invoice.item_summary);
  }

  const itemName = invoice.item_name ?? "Item";
  const quantity = invoice.quantity ?? 1;

  return `${itemName} × ${quantity}`;
}

function getInvoiceItemCount(invoice: any): number {
  return asNumber(invoice.item_count ?? 1);
}

function getInvoiceStatus(invoice: any): "posted" | "void" {
  if (invoice.status === "void" || invoice.payment_status === "void") {
    return "void";
  }

  return "posted";
}

export async function pushInvoicesToCloud(
  user: User
): Promise<InvoiceCloudPushResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  if (!context.store) {
    throw new Error("Cloud store not found. Setup store first.");
  }

  const invoices = await getInvoicesForSync();

  if (invoices.length === 0) {
    return {
      invoicesPushed: 0,
      message: "No invoices found to push.",
    };
  }

  const rows = invoices.map((invoice: any) => {
    const status = getInvoiceStatus(invoice);

    return {
      business_id: context.business!.id,
      store_id: context.store!.id,

      local_id: invoice.id,
      invoice_no: invoice.invoice_no,

      status,
      customer_local_id: invoice.customer_id ?? null,
      customer_name: invoice.customer_name ?? "Walk-in",

      payment_status: status === "void" ? "void" : invoice.payment_status,
      grand_total: asNumber(invoice.grand_total),
      paid_amount: asNumber(invoice.paid_amount),
      balance_due: status === "void" ? 0 : asNumber(invoice.balance_due),

      item_summary: getInvoiceSummary(invoice),
      item_count: getInvoiceItemCount(invoice),

      is_deleted: Number(invoice.is_deleted ?? 0) === 1,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at ?? new Date().toISOString(),
    };
  });

  const { error } = await supabase.from("invoices").upsert(rows, {
    onConflict: "business_id,local_id",
  });

  if (error) {
    throw error;
  }

  return {
    invoicesPushed: rows.length,
    message: `Invoices pushed to Supabase. Count: ${rows.length}.`,
  };
}