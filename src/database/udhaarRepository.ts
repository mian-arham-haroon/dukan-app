import { Platform } from "react-native";

import { getDatabase } from "./database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "./seed";
import { addCustomerToSyncQueue } from "./syncQueueRepository";
import type { Customer } from "../types/customer";
import type { InvoiceListItem } from "../types/invoice";
import type {
  ReceiveCustomerPaymentInput,
  UdhaarCustomer,
  UdhaarLedgerEntry,
} from "../types/udhaar";

const WEB_CUSTOMERS_KEY = "dukan_app_web_customers";
const WEB_INVOICES_KEY = "dukan_app_web_invoices";
const WEB_PAYMENTS_KEY = "dukan_app_web_payments";
const WEB_CASHBOOK_KEY = "dukan_app_web_cashbook_entries";

type WebPayment = {
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
  sync_status: "pending" | "synced" | "failed";
  is_deleted: number;
};

type WebCashbookEntry = {
  id: string;
  business_id: string;
  store_id: string;
  entry_type: string;
  amount_in: number;
  amount_out: number;
  description: string;
  ref_type: string;
  ref_id: string;
  entry_at: string;
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

function writeWebArray<T>(key: string, data: T[]) {
  const storage = (globalThis as any).localStorage;

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(data));
}

export async function getUdhaarCustomers(): Promise<UdhaarCustomer[]> {
  if (Platform.OS === "web") {
    const customers = readWebArray<Customer>(WEB_CUSTOMERS_KEY)
      .filter((customer) => customer.is_deleted === 0)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        current_balance: customer.current_balance,
        credit_limit: customer.credit_limit,
      }))
      .sort((a, b) => b.current_balance - a.current_balance);

    return customers;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  return db.getAllAsync<UdhaarCustomer>(
    `
    SELECT
      id,
      name,
      phone,
      current_balance,
      credit_limit
    FROM customers
    WHERE business_id = ?
      AND is_deleted = 0
    ORDER BY current_balance DESC, name ASC;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}

export async function getCustomerLedger(
  customerId: string
): Promise<UdhaarLedgerEntry[]> {
  if (!customerId) {
    return [];
  }

  if (Platform.OS === "web") {
    const invoices = readWebArray<any>(WEB_INVOICES_KEY)
      .filter(
        (invoice) =>
          invoice.customer_id === customerId && Number(invoice.balance_due) > 0
      )
      .map((invoice) => ({
        id: invoice.id,
        customer_id: customerId,
        type: "invoice" as const,
        title: invoice.invoice_no ?? "Invoice",
        description:
          invoice.item_summary ??
          `${invoice.item_name ?? "Item"} × ${invoice.quantity ?? 1}`,
        amount: Number(invoice.balance_due ?? 0),
        created_at: invoice.created_at,
      }));

    const payments = readWebArray<WebPayment>(WEB_PAYMENTS_KEY)
      .filter(
        (payment) =>
          payment.customer_id === customerId &&
          payment.direction === "in" &&
          payment.is_deleted === 0
      )
      .map((payment) => ({
        id: payment.id,
        customer_id: customerId,
        type: "payment" as const,
        title: "Payment received",
        description: payment.note || "Customer payment",
        amount: Number(payment.amount),
        created_at: payment.created_at,
      }));

    return [...invoices, ...payments].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  return db.getAllAsync<UdhaarLedgerEntry>(
    `
    SELECT
      invoices.id as id,
      invoices.customer_id as customer_id,
      'invoice' as type,
      invoices.invoice_no as title,
      COALESCE(
        GROUP_CONCAT(invoice_items.product_name_snapshot || ' × ' || invoice_items.quantity, ', '),
        'Invoice'
      ) as description,
      invoices.balance_due as amount,
      invoices.created_at as created_at
    FROM invoices
    LEFT JOIN invoice_items ON invoice_items.invoice_id = invoices.id
    WHERE invoices.business_id = ?
      AND invoices.customer_id = ?
      AND invoices.balance_due > 0
      AND invoices.is_deleted = 0
    GROUP BY invoices.id

    UNION ALL

    SELECT
      payments.id as id,
      payments.customer_id as customer_id,
      'payment' as type,
      'Payment received' as title,
      COALESCE(payments.note, 'Customer payment') as description,
      payments.amount as amount,
      payments.created_at as created_at
    FROM payments
    WHERE payments.business_id = ?
      AND payments.customer_id = ?
      AND payments.direction = 'in'
      AND payments.is_deleted = 0

    ORDER BY created_at DESC;
    `,
    [DEFAULT_BUSINESS_ID, customerId, DEFAULT_BUSINESS_ID, customerId]
  );
}

export async function receiveCustomerPayment(
  input: ReceiveCustomerPaymentInput
): Promise<void> {
  if (!input.customerId) {
    throw new Error("Customer is required.");
  }

  if (input.amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const customers = readWebArray<Customer>(WEB_CUSTOMERS_KEY);
    const customer = customers.find(
      (item) => item.id === input.customerId && item.is_deleted === 0
    );

    if (!customer) {
      throw new Error("Customer was not found.");
    }

    if (customer.current_balance <= 0) {
      throw new Error("This customer has no pending udhaar.");
    }

    if (input.amount > customer.current_balance) {
      throw new Error("Payment cannot be greater than current balance.");
    }

    const paymentId = generateId("payment");

    const updatedCustomers = customers.map((item) =>
      item.id === customer.id
        ? {
            ...item,
            current_balance: item.current_balance - input.amount,
            updated_at: timestamp,
            sync_status: "pending",
          }
        : item
    );

    writeWebArray(WEB_CUSTOMERS_KEY, updatedCustomers);

    const invoices = readWebArray<any>(WEB_INVOICES_KEY);
    let remainingAmount = input.amount;

    const updatedInvoices = invoices.map((invoice) => {
      if (
        invoice.customer_id !== customer.id ||
        remainingAmount <= 0 ||
        asNumber(invoice.balance_due) <= 0
      ) {
        return invoice;
      }

      const balanceDue = asNumber(invoice.balance_due);
      const paidAmount = asNumber(invoice.paid_amount);
      const allocation = Math.min(remainingAmount, balanceDue);

      if (allocation <= 0) {
        return invoice;
      }

      const newBalanceDue = balanceDue - allocation;
      const newPaidAmount = paidAmount + allocation;
      remainingAmount -= allocation;

      return {
        ...invoice,
        paid_amount: newPaidAmount,
        balance_due: newBalanceDue,
        payment_status:
          newBalanceDue === 0
            ? "paid"
            : newPaidAmount > 0
            ? "partial"
            : "unpaid",
        updated_at: timestamp,
        sync_status: "pending",
      };
    });

    writeWebArray(WEB_INVOICES_KEY, updatedInvoices);

    const payment: WebPayment = {
      id: paymentId,
      business_id: DEFAULT_BUSINESS_ID,
      invoice_id: null,
      customer_id: customer.id,
      amount: input.amount,
      method: "cash",
      direction: "in",
      paid_at: timestamp,
      note: input.note?.trim() || "Customer udhaar payment",
      created_at: timestamp,
      updated_at: timestamp,
      sync_status: "pending",
      is_deleted: 0,
    };

    const payments = readWebArray<WebPayment>(WEB_PAYMENTS_KEY);
    writeWebArray(WEB_PAYMENTS_KEY, [payment, ...payments]);

    const cashbookEntry: WebCashbookEntry = {
      id: generateId("cashbook"),
      business_id: DEFAULT_BUSINESS_ID,
      store_id: DEFAULT_STORE_ID,
      entry_type: "customer_payment",
      amount_in: input.amount,
      amount_out: 0,
      description: `Customer payment from ${customer.name}`,
      ref_type: "payment",
      ref_id: paymentId,
      entry_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      sync_status: "pending",
      is_deleted: 0,
    };

    const cashbookEntries =
      readWebArray<WebCashbookEntry>(WEB_CASHBOOK_KEY);

    writeWebArray(WEB_CASHBOOK_KEY, [cashbookEntry, ...cashbookEntries]);

    return;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const customer = await db.getFirstAsync<Customer>(
    `
    SELECT *
    FROM customers
    WHERE id = ?
      AND business_id = ?
      AND is_deleted = 0;
    `,
    [input.customerId, DEFAULT_BUSINESS_ID]
  );

  if (!customer) {
    throw new Error("Customer was not found.");
  }

  if (customer.current_balance <= 0) {
    throw new Error("This customer has no pending udhaar.");
  }

  if (input.amount > customer.current_balance) {
    throw new Error("Payment cannot be greater than current balance.");
  }

  const paymentId = generateId("payment");

  const unpaidInvoices = await db.getAllAsync<{
    id: string;
    paid_amount: number;
    balance_due: number;
  }>(
    `
    SELECT id, paid_amount, balance_due
    FROM invoices
    WHERE customer_id = ?
      AND business_id = ?
      AND balance_due > 0
      AND is_deleted = 0
    ORDER BY created_at ASC;
    `,
    [customer.id, DEFAULT_BUSINESS_ID]
  );

  let remainingAmount = input.amount;

  await db.execAsync("BEGIN TRANSACTION;");

  try {
    await db.runAsync(
      `
      UPDATE customers
      SET current_balance = current_balance - ?,
          updated_at = ?,
          sync_status = 'pending'
      WHERE id = ?
        AND business_id = ?;
      `,
      [input.amount, timestamp, customer.id, DEFAULT_BUSINESS_ID]
    );

    for (const invoice of unpaidInvoices) {
      if (remainingAmount <= 0) {
        break;
      }

      const balanceDue = asNumber(invoice.balance_due);
      if (balanceDue <= 0) {
        continue;
      }

      const paidAmount = asNumber(invoice.paid_amount);
      const allocation = Math.min(remainingAmount, balanceDue);
      const newBalanceDue = balanceDue - allocation;
      const newPaidAmount = paidAmount + allocation;
      const paymentStatus =
        newBalanceDue === 0
          ? "paid"
          : newPaidAmount > 0
          ? "partial"
          : "unpaid";

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
          paymentStatus,
          timestamp,
          invoice.id,
          DEFAULT_BUSINESS_ID,
        ]
      );

      remainingAmount -= allocation;
    }

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
        null,
        customer.id,
        input.amount,
        "cash",
        "in",
        timestamp,
        input.note?.trim() || "Customer udhaar payment",
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
        "customer_payment",
        input.amount,
        0,
        `Customer payment from ${customer.name}`,
        "payment",
        paymentId,
        timestamp,
        timestamp,
        timestamp,
        "pending",
        0,
      ]
    );

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function repairCustomerBalancesFromInvoices(): Promise<number> {
  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const customers = readWebArray<any>(WEB_CUSTOMERS_KEY);
    const invoices = readWebArray<any>(WEB_INVOICES_KEY);

    let updatedCount = 0;

    const updatedCustomers = customers.map((customer) => {
      if (customer.is_deleted === 1) return customer;

      const invoiceSum = invoices
        .filter((inv) => inv.customer_id === customer.id && inv.is_deleted === 0)
        .reduce((sum, inv) => sum + asNumber(inv.balance_due), 0);

      const newBalance = asNumber(customer.opening_balance) + invoiceSum;

      if (Number(customer.current_balance) === newBalance) {
        return customer;
      }

      updatedCount += 1;

      return {
        ...customer,
        current_balance: newBalance,
        updated_at: timestamp,
        sync_status: "pending",
      };
    });

    writeWebArray(WEB_CUSTOMERS_KEY, updatedCustomers);

    // add changed customers to web sync queue
    for (const c of updatedCustomers) {
      if (c.is_deleted === 1) continue;
      await addCustomerToSyncQueue(c.id, "upsert");
    }

    return updatedCount;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const customers = await db.getAllAsync<{
    id: string;
    opening_balance: number;
  }>(
    `SELECT id, opening_balance FROM customers WHERE business_id = ? AND is_deleted = 0;`,
    [DEFAULT_BUSINESS_ID]
  );

  let repaired = 0;

  await db.execAsync("BEGIN TRANSACTION;");

  try {
    for (const customer of customers) {
      const invoiceSumRow = await db.getFirstAsync<{ sum: number }>(
        `SELECT COALESCE(SUM(balance_due), 0) as sum FROM invoices WHERE business_id = ? AND customer_id = ? AND is_deleted = 0;`,
        [DEFAULT_BUSINESS_ID, customer.id]
      );

      const invoiceSum = asNumber(invoiceSumRow?.sum ?? 0);
      const newBalance = asNumber(customer.opening_balance) + invoiceSum;

      await db.runAsync(
        `
        UPDATE customers
        SET current_balance = ?,
            updated_at = ?,
            sync_status = 'pending'
        WHERE id = ?
          AND business_id = ?;
        `,
        [newBalance, timestamp, customer.id, DEFAULT_BUSINESS_ID]
      );

      // add to sync queue
      await addCustomerToSyncQueue(customer.id, "upsert");

      repaired += 1;
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }

  return repaired;
}