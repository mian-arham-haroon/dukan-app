import { Platform } from "react-native";

import { getDatabase } from "./database";
import { DEFAULT_BUSINESS_ID } from "./seed";
import { addCustomerToSyncQueue } from "./syncQueueRepository";
import { runAutoSync } from "../services/autoSyncService";
import type { Customer } from "../types/customer";

const WEB_CUSTOMERS_KEY = "dukan_app_web_customers";

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  openingBalance: number;
  creditLimit: number;
};

export type UpdateCustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  openingBalance: number;
  creditLimit: number;
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

function normalizeCustomerInput(
  input: CreateCustomerInput | UpdateCustomerInput
) {
  const name = input.name.trim();
  const phone = input.phone?.trim() || "";
  const address = input.address?.trim() || "";

  const openingBalance = Number(input.openingBalance || 0);
  const creditLimit = Number(input.creditLimit || 0);

  if (!name) {
    throw new Error("Customer name is required.");
  }

  if (openingBalance < 0) {
    throw new Error("Opening balance cannot be negative.");
  }

  if (creditLimit < 0) {
    throw new Error("Credit limit cannot be negative.");
  }

  return {
    name,
    phone,
    address,
    openingBalance,
    creditLimit,
  };
}

export async function getCustomers(): Promise<Customer[]> {
  if (Platform.OS === "web") {
    return readWebArray<Customer>(WEB_CUSTOMERS_KEY)
      .filter((customer) => Number(customer.is_deleted ?? 0) === 0)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  return db.getAllAsync<Customer>(
    `
    SELECT
      id,
      business_id,
      name,
      phone,
      address,
      opening_balance,
      current_balance,
      credit_limit,
      created_at,
      updated_at,
      sync_status,
      is_deleted
    FROM customers
    WHERE business_id = ?
      AND is_deleted = 0
    ORDER BY created_at DESC;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}

export async function createCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  const normalized = normalizeCustomerInput(input);
  const timestamp = nowIso();

  const customer: Customer = {
    id: generateId("customer"),
    business_id: DEFAULT_BUSINESS_ID,
    name: normalized.name,
    phone: normalized.phone,
    address: normalized.address,
    opening_balance: normalized.openingBalance,
    current_balance: normalized.openingBalance,
    credit_limit: normalized.creditLimit,
    created_at: timestamp,
    updated_at: timestamp,
    sync_status: "pending",
    is_deleted: 0,
  } as Customer;

  if (Platform.OS === "web") {
    const customers = readWebArray<Customer>(WEB_CUSTOMERS_KEY);
    writeWebArray(WEB_CUSTOMERS_KEY, [customer, ...customers]);

    await addCustomerToSyncQueue(customer.id, "upsert");
    void runAutoSync("customer_created");

    return customer;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await db.runAsync(
    `
    INSERT INTO customers (
      id,
      business_id,
      name,
      phone,
      address,
      opening_balance,
      current_balance,
      credit_limit,
      created_at,
      updated_at,
      sync_status,
      is_deleted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      customer.id,
      customer.business_id,
      customer.name,
      customer.phone,
      customer.address,
      customer.opening_balance,
      customer.current_balance,
      customer.credit_limit,
      customer.created_at,
      customer.updated_at,
      customer.sync_status,
      customer.is_deleted,
    ]
  );

  await addCustomerToSyncQueue(customer.id, "upsert");

  return customer;
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput
): Promise<void> {
  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  const normalized = normalizeCustomerInput(input);
  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const customers = readWebArray<Customer>(WEB_CUSTOMERS_KEY);

    const existingCustomer = customers.find(
      (customer) =>
        customer.id === customerId && Number(customer.is_deleted ?? 0) === 0
    );

    if (!existingCustomer) {
      throw new Error("Customer was not found.");
    }

    const updatedCustomers = customers.map((customer) =>
      customer.id === customerId
        ? ({
            ...customer,
            name: normalized.name,
            phone: normalized.phone,
            address: normalized.address,
            opening_balance: normalized.openingBalance,
            credit_limit: normalized.creditLimit,
            updated_at: timestamp,
            sync_status: "pending",
          } as Customer)
        : customer
    );

    writeWebArray(WEB_CUSTOMERS_KEY, updatedCustomers);

    await addCustomerToSyncQueue(customerId, "upsert");
    void runAutoSync("customer_updated");

    return;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const existingCustomer = await db.getFirstAsync<Customer>(
    `
    SELECT *
    FROM customers
    WHERE id = ?
      AND business_id = ?
      AND is_deleted = 0
    LIMIT 1;
    `,
    [customerId, DEFAULT_BUSINESS_ID]
  );

  if (!existingCustomer) {
    throw new Error("Customer was not found.");
  }

  await db.runAsync(
    `
    UPDATE customers
    SET name = ?,
        phone = ?,
        address = ?,
        opening_balance = ?,
        credit_limit = ?,
        updated_at = ?,
        sync_status = 'pending'
    WHERE id = ?
      AND business_id = ?;
    `,
    [
      normalized.name,
      normalized.phone,
      normalized.address,
      normalized.openingBalance,
      normalized.creditLimit,
      timestamp,
      customerId,
      DEFAULT_BUSINESS_ID,
    ]
  );

  await addCustomerToSyncQueue(customerId, "upsert");
  void runAutoSync("customer_updated");
}

export async function deleteCustomer(customerId: string): Promise<void> {
  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  const timestamp = nowIso();

  if (Platform.OS === "web") {
    const customers = readWebArray<Customer>(WEB_CUSTOMERS_KEY);

    const existingCustomer = customers.find(
      (customer) =>
        customer.id === customerId && Number(customer.is_deleted ?? 0) === 0
    );

    if (!existingCustomer) {
      throw new Error("Customer was not found.");
    }

    const updatedCustomers = customers.map((customer) =>
      customer.id === customerId
        ? ({
            ...customer,
            is_deleted: 1,
            updated_at: timestamp,
            sync_status: "pending",
          } as Customer)
        : customer
    );

    writeWebArray(WEB_CUSTOMERS_KEY, updatedCustomers);

    await addCustomerToSyncQueue(customerId, "delete");
    void runAutoSync("customer_deleted");

    return;
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const existingCustomer = await db.getFirstAsync<Customer>(
    `
    SELECT *
    FROM customers
    WHERE id = ?
      AND business_id = ?
      AND is_deleted = 0
    LIMIT 1;
    `,
    [customerId, DEFAULT_BUSINESS_ID]
  );

  if (!existingCustomer) {
    throw new Error("Customer was not found.");
  }

  await db.runAsync(
    `
    UPDATE customers
    SET is_deleted = 1,
        updated_at = ?,
        sync_status = 'pending'
    WHERE id = ?
      AND business_id = ?;
    `,
    [timestamp, customerId, DEFAULT_BUSINESS_ID]
  );

  await addCustomerToSyncQueue(customerId, "delete");
  void runAutoSync("customer_deleted");
}