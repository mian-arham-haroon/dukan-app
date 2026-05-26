import { Platform } from "react-native";

import { getDatabase } from "./database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "./seed";
import type { Customer } from "../types/customer";
import type { Product } from "../types/product";
import type {
  CreateInvoiceInput,
  CreateInvoiceLineInput,
  InvoiceListItem,
  PaymentStatus,
} from "../types/invoice";
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

type PreparedInvoiceLine = {
  product: Product;
  quantity: number;
  lineTotal: number;
};

type WebInvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
  sync_status: "pending" | "synced" | "failed";
  is_deleted: number;
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateInvoiceNo(): string {
  const stamp = Date.now().toString().slice(-6);
  return `INV-${stamp}`;
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

function normalizeLines(lines: CreateInvoiceLineInput[]): CreateInvoiceLineInput[] {
  const map = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId) continue;
    if (line.quantity <= 0) throw new Error("Each invoice item quantity must be greater than 0.");
    const previousQuantity = map.get(line.productId) ?? 0;
    map.set(line.productId, previousQuantity + line.quantity);
  }
  return Array.from(map.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

function calculatePaymentAmounts(grandTotal: number, paymentStatus: PaymentStatus, paidAmountInput: number) {
  let paidAmount = 0;
  if (paymentStatus === "paid") paidAmount = grandTotal;
  if (paymentStatus === "partial") paidAmount = paidAmountInput;
  if (paymentStatus === "unpaid") paidAmount = 0;
  if (paidAmount < 0) throw new Error("Paid amount cannot be negative.");
  if (paidAmount > grandTotal) throw new Error("Paid amount cannot be greater than invoice total.");
  return { paidAmount, balanceDue: grandTotal - paidAmount };
}

function buildItemSummary(lines: PreparedInvoiceLine[]): string {
  return lines.map((line) => `${line.product.name} × ${line.quantity}`).join(", ");
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceListItem> {
  const normalizedLines = normalizeLines(input.lines);
  if (normalizedLines.length === 0) throw new Error("Add at least one product to the invoice.");

  if (Platform.OS === "web") {
    const products = readWebArray<Product>(WEB_PRODUCTS_KEY).filter((p) => p.is_deleted === 0);
    const customers = readWebArray<Customer>(WEB_CUSTOMERS_KEY).filter((c) => c.is_deleted === 0);

    const preparedLines: PreparedInvoiceLine[] = normalizedLines.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) throw new Error("One selected product was not found.");
      if (product.stock_quantity < line.quantity) throw new Error(`Not enough stock for ${product.name}.`);
      return { product, quantity: line.quantity, lineTotal: product.selling_price * line.quantity };
    });

    const customer = input.customerId ? customers.find((c) => c.id === input.customerId) : null;
    const grandTotal = preparedLines.reduce((s, l) => s + l.lineTotal, 0);
    const amounts = calculatePaymentAmounts(grandTotal, input.paymentStatus, input.paidAmount);
    if (amounts.balanceDue > 0 && !customer) throw new Error("Customer is required for unpaid or partial invoice.");

    const timestamp = nowIso();
    const invoice: InvoiceListItem = {
      id: generateId("invoice"),
      invoice_no: generateInvoiceNo(),
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? "Walk-in",
      payment_status: input.paymentStatus,
      grand_total: grandTotal,
      paid_amount: amounts.paidAmount,
      balance_due: amounts.balanceDue,
      created_at: timestamp,
      item_summary: buildItemSummary(preparedLines),
      item_count: preparedLines.length,
    };

    const updatedProducts = readWebArray<Product>(WEB_PRODUCTS_KEY).map((product) => {
      const line = preparedLines.find((pl) => pl.product.id === product.id);
      if (!line) return product;
      return { ...product, stock_quantity: product.stock_quantity - line.quantity, updated_at: timestamp, sync_status: "pending" };
    });

    writeWebArray(WEB_PRODUCTS_KEY, updatedProducts);

    for (const line of preparedLines) {
      await addProductToSyncQueue(line.product.id, "upsert");
    }

    if (customer && amounts.balanceDue > 0) {
      const updatedCustomers = readWebArray<Customer>(WEB_CUSTOMERS_KEY).map((c) =>
        c.id === customer.id ? { ...c, current_balance: c.current_balance + amounts.balanceDue, updated_at: timestamp, sync_status: "pending" } : c
      );
      writeWebArray(WEB_CUSTOMERS_KEY, updatedCustomers);
      await addCustomerToSyncQueue(customer.id, "upsert");
    }

    const invoiceItems: WebInvoiceItem[] = preparedLines.map((line) => ({
      id: generateId("invoice-item"),
      invoice_id: invoice.id,
      product_id: line.product.id,
      product_name_snapshot: line.product.name,
      quantity: line.quantity,
      unit_price: line.product.selling_price,
      cost_price: line.product.cost_price,
      discount_amount: 0,
      line_total: line.lineTotal,
      created_at: timestamp,
      updated_at: timestamp,
      sync_status: "pending",
      is_deleted: 0,
    }));

    writeWebArray<WebInvoiceItem>(WEB_INVOICE_ITEMS_KEY, [
      ...readWebArray<WebInvoiceItem>(WEB_INVOICE_ITEMS_KEY),
      ...invoiceItems,
    ]);

    if (amounts.paidAmount > 0) {
      const payments = readWebArray<any>(WEB_PAYMENTS_KEY);
      const paymentNote = `Invoice payment for ${invoice.invoice_no}`;
      const existingPayment = payments.find(
        (payment) =>
          payment.invoice_id === invoice.id &&
          Number(payment.amount) === amounts.paidAmount &&
          payment.direction === "in" &&
          payment.method === "cash" &&
          payment.note === paymentNote
      );

      if (!existingPayment) {
        const payment = {
          id: generateId("payment"),
          business_id: DEFAULT_BUSINESS_ID,
          invoice_id: invoice.id,
          customer_id: customer?.id ?? null,
          amount: amounts.paidAmount,
          method: "cash",
          direction: "in",
          paid_at: timestamp,
          note: paymentNote,
          created_at: timestamp,
          updated_at: timestamp,
          sync_status: "pending",
          is_deleted: 0,
        };

        writeWebArray<any>(WEB_PAYMENTS_KEY, [payment, ...payments]);
      }

      const cashbookEntries = readWebArray<any>(WEB_CASHBOOK_KEY);
      const cashbookDescription = `Invoice payment for ${invoice.invoice_no}`;
      const existingCashbook = cashbookEntries.find(
        (entry) =>
          entry.ref_type === "invoice" &&
          entry.ref_id === invoice.id &&
          Number(entry.amount_in) === amounts.paidAmount &&
          entry.entry_type === "invoice_payment"
      );

      if (!existingCashbook) {
        const cashbookEntry = {
          id: generateId("cashbook"),
          business_id: DEFAULT_BUSINESS_ID,
          store_id: DEFAULT_STORE_ID,
          entry_type: "invoice_payment",
          amount_in: amounts.paidAmount,
          amount_out: 0,
          description: cashbookDescription,
          ref_type: "invoice",
          ref_id: invoice.id,
          entry_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
          sync_status: "pending",
          is_deleted: 0,
        };

        writeWebArray<any>(WEB_CASHBOOK_KEY, [cashbookEntry, ...cashbookEntries]);
      }
    }

    const invoices = readWebArray<InvoiceListItem>(WEB_INVOICES_KEY);
    writeWebArray(WEB_INVOICES_KEY, [invoice, ...invoices]);

    return invoice;
  }

  const db = await getDatabase();
  if (!db) throw new Error("SQLite database is not available.");

  const preparedLines: PreparedInvoiceLine[] = [];
  for (const line of normalizedLines) {
    const product = await db.getFirstAsync<Product>(
      `SELECT * FROM products WHERE id = ? AND business_id = ? AND is_deleted = 0;`,
      [line.productId, DEFAULT_BUSINESS_ID]
    );
    if (!product) throw new Error("One selected product was not found.");
    if (product.stock_quantity < line.quantity) throw new Error(`Not enough stock for ${product.name}.`);
    preparedLines.push({ product, quantity: line.quantity, lineTotal: product.selling_price * line.quantity });
  }

  const customer = input.customerId
    ? await db.getFirstAsync<Customer>(
        `SELECT * FROM customers WHERE id = ? AND business_id = ? AND is_deleted = 0;`,
        [input.customerId, DEFAULT_BUSINESS_ID]
      )
    : null;

  const grandTotal = preparedLines.reduce((s, l) => s + l.lineTotal, 0);
  const amounts = calculatePaymentAmounts(grandTotal, input.paymentStatus, input.paidAmount);
  if (amounts.balanceDue > 0 && !customer) throw new Error("Customer is required for unpaid or partial invoice.");

  const timestamp = nowIso();
  const invoiceId = generateId("invoice");
  const invoiceNo = generateInvoiceNo();

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    await db.runAsync(
      `INSERT INTO invoices (id, business_id, store_id, customer_id, invoice_no, status, payment_status, subtotal, discount_total, tax_total, grand_total, paid_amount, balance_due, created_at, updated_at, sync_status, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [invoiceId, DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID, customer?.id ?? null, invoiceNo, "posted", input.paymentStatus, grandTotal, 0, 0, grandTotal, amounts.paidAmount, amounts.balanceDue, timestamp, timestamp, "pending", 0]
    );

    for (const line of preparedLines) {
      const newStockQty = line.product.stock_quantity - line.quantity;

      await db.runAsync(
        `INSERT INTO invoice_items (id, invoice_id, product_id, product_name_snapshot, quantity, unit_price, cost_price, discount_amount, line_total, created_at, updated_at, sync_status, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [generateId("invoice-item"), invoiceId, line.product.id, line.product.name, line.quantity, line.product.selling_price, line.product.cost_price, 0, line.lineTotal, timestamp, timestamp, "pending", 0]
      );

      await db.runAsync(`UPDATE products SET stock_quantity = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND business_id = ?;`, [newStockQty, timestamp, line.product.id, DEFAULT_BUSINESS_ID]);

      await db.runAsync(
        `INSERT INTO stock_movements (id, business_id, store_id, product_id, movement_type, qty_delta, previous_qty, new_qty, ref_type, ref_id, occurred_at, created_at, updated_at, sync_status, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [generateId("stock-move"), DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID, line.product.id, "sale", -line.quantity, line.product.stock_quantity, newStockQty, "invoice", invoiceId, timestamp, timestamp, timestamp, "pending", 0]
      );
    }

    if (customer && amounts.balanceDue > 0) {
      await db.runAsync(`UPDATE customers SET current_balance = current_balance + ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND business_id = ?;`, [amounts.balanceDue, timestamp, customer.id, DEFAULT_BUSINESS_ID]);
    }

    if (amounts.paidAmount > 0) {
      const paymentNote = `Invoice payment for ${invoiceNo}`;
      const existingPayment = await db.getFirstAsync<any>(
        `SELECT id FROM payments WHERE invoice_id = ? AND amount = ? AND direction = 'in' AND method = 'cash' AND note = ? AND is_deleted = 0 LIMIT 1;`,
        [invoiceId, amounts.paidAmount, paymentNote]
      );

      if (!existingPayment) {
        await db.runAsync(
          `INSERT INTO payments (id, business_id, invoice_id, customer_id, amount, method, direction, paid_at, note, created_at, updated_at, sync_status, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [generateId("payment"), DEFAULT_BUSINESS_ID, invoiceId, customer?.id ?? null, amounts.paidAmount, "cash", "in", timestamp, paymentNote, timestamp, timestamp, "pending", 0]
        );
      }

      const cashbookDescription = `Invoice payment for ${invoiceNo}`;
      const existingCashbook = await db.getFirstAsync<any>(
        `SELECT id FROM cashbook_entries WHERE ref_type = 'invoice' AND ref_id = ? AND entry_type = 'invoice_payment' AND amount_in = ? AND amount_out = 0 AND is_deleted = 0 LIMIT 1;`,
        [invoiceId, amounts.paidAmount]
      );

      if (!existingCashbook) {
        await db.runAsync(
          `INSERT INTO cashbook_entries (id, business_id, store_id, entry_type, amount_in, amount_out, description, ref_type, ref_id, entry_at, created_at, updated_at, sync_status, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [generateId("cashbook"), DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID, "invoice_payment", amounts.paidAmount, 0, cashbookDescription, "invoice", invoiceId, timestamp, timestamp, timestamp, "pending", 0]
        );
      }
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }

  for (const line of preparedLines) {
    await addProductToSyncQueue(line.product.id, "upsert");
  }

  if (customer && amounts.balanceDue > 0) {
    await addCustomerToSyncQueue(customer.id, "upsert");
  }

  return {
    id: invoiceId,
    invoice_no: invoiceNo,
    customer_id: customer?.id ?? null,
    customer_name: customer?.name ?? "Walk-in",
    payment_status: input.paymentStatus,
    grand_total: grandTotal,
    paid_amount: amounts.paidAmount,
    balance_due: amounts.balanceDue,
    created_at: timestamp,
    item_summary: buildItemSummary(preparedLines),
    item_count: preparedLines.length,
  };
}

export async function getInvoices(): Promise<InvoiceListItem[]> {
  if (Platform.OS === "web") {
    const invoices = readWebArray<any>(WEB_INVOICES_KEY).filter(
      (invoice) => Number(invoice.is_deleted ?? 0) === 0
    );
    return invoices.map((invoice) => ({
      ...invoice,
      item_summary: invoice.item_summary ?? `${invoice.item_name ?? "Item"} × ${invoice.quantity ?? 1}`,
      item_count: invoice.item_count ?? 1,
    })) as InvoiceListItem[];
  }

  const db = await getDatabase();
  if (!db) throw new Error("SQLite database is not available.");

  return db.getAllAsync<InvoiceListItem>(
    `
    SELECT
      invoices.id,
      invoices.invoice_no,
      invoices.customer_id,
      COALESCE(customers.name, 'Walk-in') as customer_name,
      invoices.payment_status,
      invoices.grand_total,
      invoices.paid_amount,
      invoices.balance_due,
      invoices.created_at,
      COALESCE(GROUP_CONCAT(invoice_items.product_name_snapshot || ' × ' || invoice_items.quantity, ', '), 'Items') as item_summary,
      COUNT(invoice_items.id) as item_count
    FROM invoices
    LEFT JOIN customers ON customers.id = invoices.customer_id
    LEFT JOIN invoice_items ON invoice_items.invoice_id = invoices.id
    WHERE invoices.business_id = ?
      AND invoices.is_deleted = 0
    GROUP BY invoices.id
    ORDER BY invoices.created_at DESC;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}

export async function getInvoicesForSync(): Promise<any[]> {
  if (Platform.OS === "web") {
    return readWebArray<any>(WEB_INVOICES_KEY);
  }

  const db = await getDatabase();
  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  return db.getAllAsync<any>(
    `
    SELECT
      invoices.id,
      invoices.business_id,
      invoices.store_id,
      invoices.customer_id,
      invoices.invoice_no,
      invoices.status,
      invoices.payment_status,
      invoices.subtotal,
      invoices.discount_total,
      invoices.tax_total,
      invoices.grand_total,
      invoices.paid_amount,
      invoices.balance_due,
      invoices.created_at,
      invoices.updated_at,
      invoices.sync_status,
      invoices.is_deleted,
      customers.name as customer_name
    FROM invoices
    LEFT JOIN customers ON customers.id = invoices.customer_id
    WHERE invoices.business_id = ?
    ORDER BY invoices.created_at DESC;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}

export async function getInvoiceById(invoiceId: string) {
  if (!invoiceId) throw new Error("Invoice ID is required.");

  if (Platform.OS === "web") {
    const invoices = readWebArray<any>(WEB_INVOICES_KEY);
    const invoice = invoices.find((i) => i.id === invoiceId && Number(i.is_deleted ?? 0) === 0);
    if (!invoice) throw new Error("Invoice not found.");
    return { ...invoice };
  }

  const db = await getDatabase();
  if (!db) throw new Error("SQLite database is not available.");

  const invoice = await db.getFirstAsync<any>(`SELECT * FROM invoices WHERE id = ? AND business_id = ? AND is_deleted = 0 LIMIT 1;`, [invoiceId, DEFAULT_BUSINESS_ID]);
  if (!invoice) throw new Error("Invoice not found.");

  const items = await db.getAllAsync<any>(`SELECT * FROM invoice_items WHERE invoice_id = ? AND is_deleted = 0 ORDER BY created_at ASC;`, [invoiceId]);

  return { ...invoice, items };
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  if (!invoiceId) throw new Error("Invoice ID is required.");
  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const invoices = readWebArray<any>(WEB_INVOICES_KEY);
    const updated = invoices.map((inv) => (inv.id === invoiceId ? { ...inv, is_deleted: 1, updated_at: timestamp } : inv));
    writeWebArray(WEB_INVOICES_KEY, updated);
    return;
  }

  const db = await getDatabase();
  if (!db) throw new Error("SQLite database is not available.");

  await db.runAsync(`UPDATE invoices SET is_deleted = 1, updated_at = ? WHERE id = ? AND business_id = ?;`, [timestamp, invoiceId, DEFAULT_BUSINESS_ID]);
}
