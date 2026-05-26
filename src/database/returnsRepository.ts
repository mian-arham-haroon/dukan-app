import { Platform } from "react-native";

import { getDatabase } from "./database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "./seed";
import {
  addCustomerToSyncQueue,
  addProductToSyncQueue,
} from "./syncQueueRepository";
import type {
  CreateInvoiceReturnInput,
  InvoiceReturnLine,
  InvoiceReturnPreview,
  ReturnPreviewLine,
} from "../types/return";

const WEB_PRODUCTS_KEY = "dukan_app_web_products";
const WEB_CUSTOMERS_KEY = "dukan_app_web_customers";
const WEB_INVOICES_KEY = "dukan_app_web_invoices";
const WEB_INVOICE_ITEMS_KEY = "dukan_app_web_invoice_items";
const WEB_PAYMENTS_KEY = "dukan_app_web_payments";
const WEB_CASHBOOK_KEY = "dukan_app_web_cashbook_entries";
const WEB_RETURNS_KEY = "dukan_app_web_invoice_returns";

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

export async function ensureReturnsTable() {
  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS invoice_returns (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      invoice_item_local_id TEXT,
      product_id TEXT,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      balance_reduced REAL NOT NULL DEFAULT 0,
      cash_refund REAL NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info('invoice_returns');`
  );

  if (!columns.some((column) => column.name === "invoice_item_local_id")) {
    await db.execAsync(`ALTER TABLE invoice_returns ADD COLUMN invoice_item_local_id TEXT;`);
  }

  return db;
}

function getPaymentStatus(paidAmount: number, balanceDue: number): string {
  if (balanceDue <= 0) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
}

function buildReturnKey(productId: string | null, productName: string): string {
  return productId ? `id:${productId}` : `name:${productName.trim().toLowerCase()}`;
}

function aggregateReturnedQuantities(returns: InvoiceReturnLine[]) {
  const map = new Map<string, number>();

  for (const item of returns) {
    const key = buildReturnKey(item.product_id, item.product_name);
    map.set(key, (map.get(key) ?? 0) + asNumber(item.quantity));
  }

  return map;
}

function matchesInvoiceIdentifier(invoice: any, identifier?: string): boolean {
  if (!identifier) {
    return false;
  }

  return (
    invoice.id === identifier ||
    invoice.local_id === identifier ||
    invoice.invoice_local_id === identifier ||
    invoice.localInvoiceId === identifier ||
    invoice.invoiceId === identifier ||
    invoice.local_invoice_id === identifier ||
    invoice.invoiceLocalId === identifier ||
    invoice.invoice_no === identifier ||
    invoice.invoiceNo === identifier
  );
}

function matchesInvoiceItemIdentifier(item: any, identifier: string): boolean {
  return (
    item.invoice_id === identifier ||
    item.invoiceId === identifier ||
    item.invoice_local_id === identifier ||
    item.invoiceLocalId === identifier ||
    item.local_invoice_id === identifier ||
    item.localInvoiceId === identifier
  );
}

export async function getInvoiceReturnPreview(
  invoiceId: string,
  localInvoiceId?: string
): Promise<InvoiceReturnPreview> {
  if (!invoiceId) {
    throw new Error("Invoice id is required.");
  }

  if (Platform.OS === "web") {
    const invoices = readWebArray<any>(WEB_INVOICES_KEY);
    const invoice = invoices.find(
      (item) =>
        Number(item.is_deleted ?? 0) === 0 &&
        (matchesInvoiceIdentifier(item, localInvoiceId) ||
          matchesInvoiceIdentifier(item, invoiceId))
    );

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    if (invoice.status === "void" || invoice.payment_status === "void") {
      throw new Error("Voided invoice cannot be returned.");
    }

    let items = readWebArray<any>(WEB_INVOICE_ITEMS_KEY).filter(
      (item) =>
        ((localInvoiceId != null && matchesInvoiceItemIdentifier(item, localInvoiceId)) ||
          matchesInvoiceItemIdentifier(item, invoiceId)) &&
        Number(item.is_deleted ?? 0) === 0
    );

    if (items.length === 0) {
      const embeddedItems =
        invoice.items ??
        invoice.invoice_items ??
        invoice.line_items ??
        invoice.lines ??
        [];

      items = Array.isArray(embeddedItems) ? embeddedItems : [];
    }

    if (items.length === 0) {
      throw new Error("Invoice items not found.");
    }

    const returns = readWebArray<InvoiceReturnLine>(WEB_RETURNS_KEY).filter(
      (item) => item.invoice_id === invoiceId
    );

    const returnedMap = aggregateReturnedQuantities(returns);

    const lines: ReturnPreviewLine[] = items.map((item) => {
      const productId =
        item.product_id ??
        item.productId ??
        item.id ??
        null;

      const productName = String(
        item.product_name_snapshot ??
          item.product_name ??
          item.productName ??
          item.name ??
          item.item_name ??
          "Item"
      );

      const soldQuantity = asNumber(
        item.quantity ??
          item.qty ??
          item.count ??
          0
      );

      const unitPrice = asNumber(
        item.unit_price ??
          item.unitPrice ??
          item.price ??
          item.selling_price ??
          item.sellingPrice ??
          0
      );

      const alreadyReturnedQuantity =
        returnedMap.get(buildReturnKey(productId, productName)) ?? 0;

      return {
        productId,
        productName,
        soldQuantity,
        alreadyReturnedQuantity,
        maxReturnQuantity: Math.max(0, soldQuantity - alreadyReturnedQuantity),
        unitPrice,
      };
    });

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoice_no,
      customerId: invoice.customer_id ?? null,
      customerName: invoice.customer_name ?? "Walk-in",
      paymentStatus: invoice.payment_status,
      balanceDue: asNumber(invoice.balance_due),
      paidAmount: asNumber(invoice.paid_amount),
      lines,
    };
  }

  const db = await ensureReturnsTable();

  const invoice = await db.getFirstAsync<any>(
    `
    SELECT
      invoices.id,
      invoices.invoice_no,
      invoices.customer_id,
      COALESCE(customers.name, 'Walk-in') as customer_name,
      invoices.status,
      invoices.payment_status,
      invoices.balance_due,
      invoices.paid_amount
    FROM invoices
    LEFT JOIN customers ON customers.id = invoices.customer_id
    WHERE invoices.id = ?
      AND invoices.business_id = ?
      AND invoices.is_deleted = 0
    LIMIT 1;
    `,
    [invoiceId, DEFAULT_BUSINESS_ID]
  );

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (invoice.status === "void" || invoice.payment_status === "void") {
    throw new Error("Voided invoice cannot be returned.");
  }

  const items = await db.getAllAsync<any>(
    `
    SELECT
      product_id,
      product_name_snapshot,
      quantity,
      unit_price
    FROM invoice_items
    WHERE invoice_id = ?
      AND is_deleted = 0;
    `,
    [invoiceId]
  );

  if (items.length === 0) {
    throw new Error("Invoice items not found.");
  }

  const returns = await db.getAllAsync<InvoiceReturnLine>(
    `
    SELECT *
    FROM invoice_returns
    WHERE invoice_id = ?
      AND is_deleted = 0;
    `,
    [invoiceId]
  );

  const returnedMap = aggregateReturnedQuantities(returns);

  const lines: ReturnPreviewLine[] = items.map((item) => {
    const productId = item.product_id ?? null;
    const productName = String(item.product_name_snapshot ?? "Item");
    const soldQuantity = asNumber(item.quantity);
    const alreadyReturnedQuantity =
      returnedMap.get(buildReturnKey(productId, productName)) ?? 0;

    return {
      productId,
      productName,
      soldQuantity,
      alreadyReturnedQuantity,
      maxReturnQuantity: Math.max(0, soldQuantity - alreadyReturnedQuantity),
      unitPrice: asNumber(item.unit_price),
    };
  });

  return {
    invoiceId: invoice.id,
    invoiceNo: invoice.invoice_no,
    customerId: invoice.customer_id ?? null,
    customerName: invoice.customer_name ?? "Walk-in",
    paymentStatus: invoice.payment_status,
    balanceDue: asNumber(invoice.balance_due),
    paidAmount: asNumber(invoice.paid_amount),
    lines,
  };
}

export async function createInvoiceReturn(
  input: CreateInvoiceReturnInput
): Promise<{ message: string }> {
  if (!input.invoiceId) {
    throw new Error("Invoice id is required.");
  }

  const selectedLines = input.lines.filter((line) => asNumber(line.quantity) > 0);

  if (selectedLines.length === 0) {
    throw new Error("Enter return quantity for at least one item.");
  }

  const preview = await getInvoiceReturnPreview(input.invoiceId);
  const timestamp = nowIso();

  let remainingBalanceToReduce = preview.balanceDue;
  let totalReturned = 0;
  let totalBalanceReduced = 0;
  let totalCashRefund = 0;

  const affectedProductIds: string[] = [];

  if (Platform.OS === "web") {
    const products = readWebArray<any>(WEB_PRODUCTS_KEY);
    const customers = readWebArray<any>(WEB_CUSTOMERS_KEY);
    const invoices = readWebArray<any>(WEB_INVOICES_KEY);
    const payments = readWebArray<any>(WEB_PAYMENTS_KEY);
    const cashbookEntries = readWebArray<any>(WEB_CASHBOOK_KEY);
    const existingReturns = readWebArray<InvoiceReturnLine>(WEB_RETURNS_KEY);

    const newReturns: InvoiceReturnLine[] = [];
    const updatedProducts = [...products];

    for (const inputLine of selectedLines) {
      const previewLine = preview.lines.find(
        (line) =>
          buildReturnKey(line.productId, line.productName) ===
          buildReturnKey(inputLine.productId, inputLine.productName)
      );

      if (!previewLine) {
        throw new Error(`Return item not found: ${inputLine.productName}`);
      }

      const returnQty = asNumber(inputLine.quantity);

      if (returnQty > previewLine.maxReturnQuantity) {
        throw new Error(
          `Return quantity for ${previewLine.productName} cannot be greater than ${previewLine.maxReturnQuantity}.`
        );
      }

      const lineTotal = returnQty * previewLine.unitPrice;
      const balanceReduced = Math.min(lineTotal, remainingBalanceToReduce);
      const cashRefund = lineTotal - balanceReduced;

      remainingBalanceToReduce -= balanceReduced;
      totalReturned += lineTotal;
      totalBalanceReduced += balanceReduced;
      totalCashRefund += cashRefund;

      const productIndex = updatedProducts.findIndex((product) => {
        if (previewLine.productId && product.id === previewLine.productId) {
          return true;
        }

        return (
          String(product.name).trim().toLowerCase() ===
          previewLine.productName.trim().toLowerCase()
        );
      });

      if (productIndex < 0) {
        throw new Error(`Product not found: ${previewLine.productName}`);
      }

      const product = updatedProducts[productIndex];

      updatedProducts[productIndex] = {
        ...product,
        stock_quantity: asNumber(product.stock_quantity) + returnQty,
        updated_at: timestamp,
        sync_status: "pending",
      };

      affectedProductIds.push(product.id);

      const invoiceItem = readWebArray<any>(WEB_INVOICE_ITEMS_KEY).find((item) => {
        if (Number(item.is_deleted ?? 0) !== 0) {
          return false;
        }

        if (previewLine.productId && item.product_id === previewLine.productId) {
          return item.invoice_id === preview.invoiceId;
        }

        const itemName = String(
          item.product_name_snapshot ?? item.product_name ?? item.name ?? ""
        )
          .trim()
          .toLowerCase();

        return (
          item.invoice_id === preview.invoiceId &&
          itemName === previewLine.productName.trim().toLowerCase()
        );
      });

      newReturns.push({
        id: generateId("return"),
        invoice_id: preview.invoiceId,
        invoice_item_local_id: invoiceItem?.id ?? null,
        product_id: product.id,
        product_name: previewLine.productName,
        quantity: returnQty,
        unit_price: previewLine.unitPrice,
        line_total: lineTotal,
        balance_reduced: balanceReduced,
        cash_refund: cashRefund,
        note: input.note?.trim() || null,
        created_at: timestamp,
      });
    }

    writeWebArray(WEB_PRODUCTS_KEY, updatedProducts);

    if (preview.customerId && totalBalanceReduced > 0) {
      const updatedCustomers = customers.map((customer) =>
        customer.id === preview.customerId
          ? {
              ...customer,
              current_balance: Math.max(
                0,
                asNumber(customer.current_balance) - totalBalanceReduced
              ),
              updated_at: timestamp,
              sync_status: "pending",
            }
          : customer
      );

      writeWebArray(WEB_CUSTOMERS_KEY, updatedCustomers);
      await addCustomerToSyncQueue(preview.customerId, "upsert");
    }

    const newBalanceDue = Math.max(0, preview.balanceDue - totalBalanceReduced);
    const newPaidAmount = Math.max(0, preview.paidAmount - totalCashRefund);

    const updatedInvoices = invoices.map((invoice) =>
      invoice.id === preview.invoiceId
        ? {
            ...invoice,
            paid_amount: newPaidAmount,
            balance_due: newBalanceDue,
            payment_status: getPaymentStatus(newPaidAmount, newBalanceDue),
            updated_at: timestamp,
            sync_status: "pending",
          }
        : invoice
    );

    writeWebArray(WEB_INVOICES_KEY, updatedInvoices);
    writeWebArray(WEB_RETURNS_KEY, [...newReturns, ...existingReturns]);

    if (totalCashRefund > 0) {
      const paymentId = generateId("payment");

      writeWebArray(WEB_PAYMENTS_KEY, [
        {
          id: paymentId,
          business_id: DEFAULT_BUSINESS_ID,
          invoice_id: preview.invoiceId,
          customer_id: preview.customerId,
          amount: totalCashRefund,
          method: "cash",
          direction: "out",
          paid_at: timestamp,
          note: `Refund for ${preview.invoiceNo}`,
          created_at: timestamp,
          updated_at: timestamp,
          sync_status: "pending",
          is_deleted: 0,
        },
        ...payments,
      ]);

      writeWebArray(WEB_CASHBOOK_KEY, [
        {
          id: generateId("cashbook"),
          business_id: DEFAULT_BUSINESS_ID,
          store_id: DEFAULT_STORE_ID,
          entry_type: "sales_return_refund",
          amount_in: 0,
          amount_out: totalCashRefund,
          description: `Cash refund for ${preview.invoiceNo}`,
          ref_type: "invoice_return",
          ref_id: preview.invoiceId,
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

    return {
      message: `Return saved. Returned Rs ${totalReturned}. Balance reduced Rs ${totalBalanceReduced}. Cash refund Rs ${totalCashRefund}.`,
    };
  }

  const db = await ensureReturnsTable();

  await db.execAsync("BEGIN TRANSACTION;");

  try {
    for (const inputLine of selectedLines) {
      const previewLine = preview.lines.find(
        (line) =>
          buildReturnKey(line.productId, line.productName) ===
          buildReturnKey(inputLine.productId, inputLine.productName)
      );

      if (!previewLine) {
        throw new Error(`Return item not found: ${inputLine.productName}`);
      }

      const returnQty = asNumber(inputLine.quantity);

      if (returnQty > previewLine.maxReturnQuantity) {
        throw new Error(
          `Return quantity for ${previewLine.productName} cannot be greater than ${previewLine.maxReturnQuantity}.`
        );
      }

      if (!previewLine.productId) {
        throw new Error(`Product id missing for ${previewLine.productName}`);
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
        [previewLine.productId, DEFAULT_BUSINESS_ID]
      );

      if (!product) {
        throw new Error(`Product not found: ${previewLine.productName}`);
      }

      const lineTotal = returnQty * previewLine.unitPrice;
      const balanceReduced = Math.min(lineTotal, remainingBalanceToReduce);
      const cashRefund = lineTotal - balanceReduced;

      remainingBalanceToReduce -= balanceReduced;
      totalReturned += lineTotal;
      totalBalanceReduced += balanceReduced;
      totalCashRefund += cashRefund;

      const previousQty = asNumber(product.stock_quantity);
      const newQty = previousQty + returnQty;

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
          "sales_return",
          returnQty,
          previousQty,
          newQty,
          "invoice_return",
          preview.invoiceId,
          timestamp,
          timestamp,
          timestamp,
          "pending",
          0,
        ]
      );

      const invoiceItemRow = await db.getFirstAsync<any>(
        `
        SELECT id
        FROM invoice_items
        WHERE invoice_id = ?
          AND is_deleted = 0
          AND (
            (? IS NOT NULL AND product_id = ?)
            OR product_name_snapshot = ?
          )
        LIMIT 1;
        `,
        [
          preview.invoiceId,
          previewLine.productId,
          previewLine.productId,
          previewLine.productName,
        ]
      );

      const invoiceItemLocalId = invoiceItemRow?.id ?? null;

      await db.runAsync(
        `
        INSERT INTO invoice_returns (
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
          generateId("return"),
          DEFAULT_BUSINESS_ID,
          DEFAULT_STORE_ID,
          preview.invoiceId,
          invoiceItemLocalId,
          product.id,
          previewLine.productName,
          returnQty,
          previewLine.unitPrice,
          lineTotal,
          balanceReduced,
          cashRefund,
          input.note?.trim() || null,
          timestamp,
          timestamp,
          "pending",
          0,
        ]
      );

      affectedProductIds.push(product.id);
    }

    if (preview.customerId && totalBalanceReduced > 0) {
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
          totalBalanceReduced,
          totalBalanceReduced,
          timestamp,
          preview.customerId,
          DEFAULT_BUSINESS_ID,
        ]
      );
    }

    const newBalanceDue = Math.max(0, preview.balanceDue - totalBalanceReduced);
    const newPaidAmount = Math.max(0, preview.paidAmount - totalCashRefund);

    await db.runAsync(
      `
      UPDATE invoices
      SET paid_amount = ?,
          balance_due = ?,
          payment_status = ?,
          updated_at = ?,
          sync_status = 'pending'
      WHERE id = ?
        AND business_id = ?;
      `,
      [
        newPaidAmount,
        newBalanceDue,
        getPaymentStatus(newPaidAmount, newBalanceDue),
        timestamp,
        preview.invoiceId,
        DEFAULT_BUSINESS_ID,
      ]
    );

    if (totalCashRefund > 0) {
      const paymentId = generateId("payment");

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
          paymentId,
          DEFAULT_BUSINESS_ID,
          preview.invoiceId,
          preview.customerId,
          totalCashRefund,
          "cash",
          "out",
          timestamp,
          `Refund for ${preview.invoiceNo}`,
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
          "sales_return_refund",
          0,
          totalCashRefund,
          `Cash refund for ${preview.invoiceNo}`,
          "invoice_return",
          preview.invoiceId,
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

  if (preview.customerId && totalBalanceReduced > 0) {
    await addCustomerToSyncQueue(preview.customerId, "upsert");
  }

  return {
    message: `Return saved. Returned Rs ${totalReturned}. Balance reduced Rs ${totalBalanceReduced}. Cash refund Rs ${totalCashRefund}.`,
  };
}

export async function getInvoiceReturnsForSync(): Promise<InvoiceReturnLine[]> {
  if (Platform.OS === "web") {
    return readWebArray<InvoiceReturnLine>(WEB_RETURNS_KEY);
  }

  const db = await ensureReturnsTable();

  return db.getAllAsync<InvoiceReturnLine>(
    `
    SELECT *
    FROM invoice_returns
    ORDER BY created_at DESC;
    `
  );
}

export async function getInvoiceReturns(): Promise<InvoiceReturnLine[]> {
  if (Platform.OS === "web") {
    return readWebArray<InvoiceReturnLine>(WEB_RETURNS_KEY);
  }

  const db = await ensureReturnsTable();

  return db.getAllAsync<InvoiceReturnLine>(
    `
    SELECT *
    FROM invoice_returns
    WHERE is_deleted = 0
    ORDER BY created_at DESC;
    `
  );
}