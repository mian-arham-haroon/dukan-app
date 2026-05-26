import { Platform } from "react-native";

import { getDatabase } from "./database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "./seed";
import {
  addCustomerToSyncQueue,
  addProductToSyncQueue,
} from "./syncQueueRepository";

const WEB_PRODUCTS_KEY = "dukan_app_web_products";
const WEB_CUSTOMERS_KEY = "dukan_app_web_customers";
const WEB_INVOICES_KEY = "dukan_app_web_invoices";
const WEB_INVOICE_ITEMS_KEY = "dukan_app_web_invoice_items";
const WEB_PAYMENTS_KEY = "dukan_app_web_payments";
const WEB_CASHBOOK_KEY = "dukan_app_web_cashbook_entries";

type VoidInvoiceResult = {
  message: string;
};

type WebInvoice = {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  customer_name?: string;
  status?: string;
  payment_status: string;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  item_summary?: string;
  item_count?: number;
  created_at: string;
  updated_at?: string;
  sync_status?: string;
  is_deleted?: number;
};

type VoidLine = {
  product_id: string | null;
  product_name: string;
  quantity: number;
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
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

function parseSummaryLines(summary: string): VoidLine[] {
  if (!summary.trim()) {
    return [];
  }

  return summary
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s*[×x]\s*(\d+(\.\d+)?)$/i);

      if (!match) {
        return {
          product_id: null,
          product_name: part,
          quantity: 1,
        };
      }

      return {
        product_id: null,
        product_name: match[1].trim(),
        quantity: asNumber(match[2]) || 1,
      };
    });
}

function getWebInvoiceLines(invoice: WebInvoice): VoidLine[] {
  const items = readWebArray<any>(WEB_INVOICE_ITEMS_KEY).filter(
    (item) =>
      item.invoice_id === invoice.id && Number(item.is_deleted ?? 0) === 0
  );

  if (items.length > 0) {
    return items.map((item) => ({
      product_id: item.product_id ?? null,
      product_name: String(
        item.product_name_snapshot ?? item.product_name ?? "Item"
      ),
      quantity: asNumber(item.quantity),
    }));
  }

  return parseSummaryLines(invoice.item_summary ?? "");
}

function isInvoiceVoided(invoice: WebInvoice | any): boolean {
  return invoice.status === "void" || invoice.payment_status === "void";
}

export async function voidInvoice(invoiceId: string): Promise<VoidInvoiceResult> {
  if (!invoiceId) {
    throw new Error("Invoice id is required.");
  }

  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const invoices = readWebArray<WebInvoice>(WEB_INVOICES_KEY);
    const invoice = invoices.find(
      (item) => item.id === invoiceId && Number(item.is_deleted ?? 0) === 0
    );

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    if (isInvoiceVoided(invoice)) {
      throw new Error("This invoice is already voided.");
    }

    const lines = getWebInvoiceLines(invoice);

    if (lines.length === 0) {
      throw new Error("Invoice items not found. Cannot restore stock safely.");
    }

    const products = readWebArray<any>(WEB_PRODUCTS_KEY);
    const customers = readWebArray<any>(WEB_CUSTOMERS_KEY);

    const affectedProductIds: string[] = [];

    const updatedProducts = [...products];

    for (const line of lines) {
      const productIndex = updatedProducts.findIndex((product) => {
        if (line.product_id && product.id === line.product_id) {
          return true;
        }

        return (
          String(product.name).trim().toLowerCase() ===
            line.product_name.trim().toLowerCase() &&
          Number(product.is_deleted ?? 0) === 0
        );
      });

      if (productIndex < 0) {
        throw new Error(
          `Cannot void invoice. Product not found for item: ${line.product_name}`
        );
      }

      const product = updatedProducts[productIndex];

      updatedProducts[productIndex] = {
        ...product,
        stock_quantity: asNumber(product.stock_quantity) + line.quantity,
        updated_at: timestamp,
        sync_status: "pending",
      };

      affectedProductIds.push(product.id);
    }

    writeWebArray(WEB_PRODUCTS_KEY, updatedProducts);

    let updatedCustomers = customers;

    const balanceDue = asNumber(invoice.balance_due);

    if (invoice.customer_id && balanceDue > 0) {
      updatedCustomers = customers.map((customer) =>
        customer.id === invoice.customer_id
          ? {
              ...customer,
              current_balance: Math.max(
                0,
                asNumber(customer.current_balance) - balanceDue
              ),
              updated_at: timestamp,
              sync_status: "pending",
            }
          : customer
      );

      writeWebArray(WEB_CUSTOMERS_KEY, updatedCustomers);
    }

    const updatedInvoices = invoices.map((item) =>
      item.id === invoice.id
        ? {
            ...item,
            status: "void",
            payment_status: "void",
            balance_due: 0,
            updated_at: timestamp,
            sync_status: "pending",
          }
        : item
    );

    writeWebArray(WEB_INVOICES_KEY, updatedInvoices);

    const paidAmount = asNumber(invoice.paid_amount);

    if (paidAmount > 0) {
      const reversalPaymentId = generateId("payment");

      const payments = readWebArray<any>(WEB_PAYMENTS_KEY);

      writeWebArray(WEB_PAYMENTS_KEY, [
        {
          id: reversalPaymentId,
          business_id: DEFAULT_BUSINESS_ID,
          invoice_id: invoice.id,
          customer_id: invoice.customer_id,
          amount: paidAmount,
          method: "cash",
          direction: "out",
          paid_at: timestamp,
          note: `Void reversal for ${invoice.invoice_no}`,
          created_at: timestamp,
          updated_at: timestamp,
          sync_status: "pending",
          is_deleted: 0,
        },
        ...payments,
      ]);

      const cashbookEntries = readWebArray<any>(WEB_CASHBOOK_KEY);

      writeWebArray(WEB_CASHBOOK_KEY, [
        {
          id: generateId("cashbook"),
          business_id: DEFAULT_BUSINESS_ID,
          store_id: DEFAULT_STORE_ID,
          entry_type: "invoice_void_reversal",
          amount_in: 0,
          amount_out: paidAmount,
          description: `Cash reversal for void invoice ${invoice.invoice_no}`,
          ref_type: "invoice_void",
          ref_id: invoice.id,
          entry_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
          sync_status: "pending",
          is_deleted: 0,
        },
        ...cashbookEntries,
      ]);
    }

    for (const productId of Array.from(new Set(affectedProductIds))) {
      await addProductToSyncQueue(productId, "upsert");
    }

    if (invoice.customer_id && balanceDue > 0) {
      await addCustomerToSyncQueue(invoice.customer_id, "upsert");
    }

    return {
      message: `Invoice ${invoice.invoice_no} voided successfully.`,
    };
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const invoice = await db.getFirstAsync<any>(
    `
    SELECT *
    FROM invoices
    WHERE id = ?
      AND business_id = ?
      AND is_deleted = 0
    LIMIT 1;
    `,
    [invoiceId, DEFAULT_BUSINESS_ID]
  );

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (isInvoiceVoided(invoice)) {
    throw new Error("This invoice is already voided.");
  }

  const lines = await db.getAllAsync<any>(
    `
    SELECT
      id,
      invoice_id,
      product_id,
      product_name_snapshot,
      quantity
    FROM invoice_items
    WHERE invoice_id = ?
      AND is_deleted = 0;
    `,
    [invoiceId]
  );

  if (lines.length === 0) {
    throw new Error("Invoice items not found. Cannot restore stock safely.");
  }

  const affectedProductIds: string[] = [];

  await db.execAsync("BEGIN TRANSACTION;");

  try {
    for (const line of lines) {
      if (!line.product_id) {
        throw new Error(
          `Cannot restore stock for ${line.product_name_snapshot}. Product id is missing.`
        );
      }

      const product = await db.getFirstAsync<any>(
        `
        SELECT id, stock_quantity
        FROM products
        WHERE id = ?
          AND business_id = ?
          AND is_deleted = 0
        LIMIT 1;
        `,
        [line.product_id, DEFAULT_BUSINESS_ID]
      );

      if (!product) {
        throw new Error(
          `Product not found for item: ${line.product_name_snapshot}`
        );
      }

      const previousQty = asNumber(product.stock_quantity);
      const quantity = asNumber(line.quantity);
      const newQty = previousQty + quantity;

      await db.runAsync(
        `
        UPDATE products
        SET stock_quantity = ?,
            updated_at = ?,
            sync_status = 'pending'
        WHERE id = ?
          AND business_id = ?;
        `,
        [newQty, timestamp, product.id, DEFAULT_BUSINESS_ID]
      );

      await db.runAsync(
        `
        INSERT INTO stock_movements (
          id,
          business_id,
          store_id,
          product_id,
          movement_type,
          qty_delta,
          previous_qty,
          new_qty,
          ref_type,
          ref_id,
          occurred_at,
          created_at,
          updated_at,
          sync_status,
          is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          generateId("stock-move"),
          DEFAULT_BUSINESS_ID,
          DEFAULT_STORE_ID,
          product.id,
          "invoice_void",
          quantity,
          previousQty,
          newQty,
          "invoice",
          invoice.id,
          timestamp,
          timestamp,
          timestamp,
          "pending",
          0,
        ]
      );

      affectedProductIds.push(product.id);
    }

    const balanceDue = asNumber(invoice.balance_due);

    if (invoice.customer_id && balanceDue > 0) {
      await db.runAsync(
        `
        UPDATE customers
        SET current_balance =
              CASE
                WHEN current_balance - ? < 0 THEN 0
                ELSE current_balance - ?
              END,
            updated_at = ?,
            sync_status = 'pending'
        WHERE id = ?
          AND business_id = ?;
        `,
        [
          balanceDue,
          balanceDue,
          timestamp,
          invoice.customer_id,
          DEFAULT_BUSINESS_ID,
        ]
      );
    }

    await db.runAsync(
      `
      UPDATE invoices
      SET status = 'void',
          payment_status = 'void',
          balance_due = 0,
          updated_at = ?,
          sync_status = 'pending'
      WHERE id = ?
        AND business_id = ?;
      `,
      [timestamp, invoice.id, DEFAULT_BUSINESS_ID]
    );

    const paidAmount = asNumber(invoice.paid_amount);

    if (paidAmount > 0) {
      const reversalPaymentId = generateId("payment");

      await db.runAsync(
        `
        INSERT INTO payments (
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
          reversalPaymentId,
          DEFAULT_BUSINESS_ID,
          invoice.id,
          invoice.customer_id ?? null,
          paidAmount,
          "cash",
          "out",
          timestamp,
          `Void reversal for ${invoice.invoice_no}`,
          timestamp,
          timestamp,
          "pending",
          0,
        ]
      );

      await db.runAsync(
        `
        INSERT INTO cashbook_entries (
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
          generateId("cashbook"),
          DEFAULT_BUSINESS_ID,
          DEFAULT_STORE_ID,
          "invoice_void_reversal",
          0,
          paidAmount,
          `Cash reversal for void invoice ${invoice.invoice_no}`,
          "invoice_void",
          invoice.id,
          timestamp,
          timestamp,
          timestamp,
          "pending",
          0,
        ]
      );
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }

  for (const productId of Array.from(new Set(affectedProductIds))) {
    await addProductToSyncQueue(productId, "upsert");
  }

  if (invoice.customer_id && asNumber(invoice.balance_due) > 0) {
    await addCustomerToSyncQueue(invoice.customer_id, "upsert");
  }

  return {
    message: `Invoice ${invoice.invoice_no} voided successfully.`,
  };
}