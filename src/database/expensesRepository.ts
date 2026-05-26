import { Platform } from "react-native";

import { getDatabase } from "./database";
import { DEFAULT_BUSINESS_ID, DEFAULT_STORE_ID } from "./seed";
import type {
  CashbookEntry,
  CashbookSummary,
  CreateDailyCloseInput,
  CreateExpenseInput,
  DailyClose,
} from "../types/expense";

const WEB_CASHBOOK_KEY = "dukan_app_web_cashbook_entries";
const WEB_DAILY_CLOSES_KEY = "dukan_app_web_daily_closes";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
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

async function ensureCashbookTable() {
  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cashbook_entries (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      amount_in REAL NOT NULL DEFAULT 0,
      amount_out REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      ref_type TEXT,
      ref_id TEXT,
      entry_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}

async function ensureDailyCloseTable() {
  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_closes (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      expected_cash REAL NOT NULL DEFAULT 0,
      actual_cash REAL NOT NULL DEFAULT 0,
      difference REAL NOT NULL DEFAULT 0,
      note TEXT,
      closed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}

function buildSummary(entries: CashbookEntry[]): CashbookSummary {
  const totalCashIn = entries.reduce(
    (sum, entry) => sum + Number(entry.amount_in || 0),
    0
  );

  const totalCashOut = entries.reduce(
    (sum, entry) => sum + Number(entry.amount_out || 0),
    0
  );

  const expenseTotal = entries
    .filter((entry) => entry.entry_type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount_out || 0), 0);

  return {
    totalCashIn,
    totalCashOut,
    expectedCash: totalCashIn - totalCashOut,
    expenseTotal,
    entryCount: entries.length,
  };
}

export async function getCashbookEntries(): Promise<CashbookEntry[]> {
  if (Platform.OS === "web") {
    return readWebArray<CashbookEntry>(WEB_CASHBOOK_KEY)
      .filter((entry) => entry.is_deleted === 0)
      .sort(
        (a, b) =>
          new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime()
      );
  }

  const db = await ensureCashbookTable();

  return db.getAllAsync<CashbookEntry>(
    `
    SELECT
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
    FROM cashbook_entries
    WHERE business_id = ?
      AND is_deleted = 0
    ORDER BY entry_at DESC;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}

export async function getTodayCashbookEntries(): Promise<CashbookEntry[]> {
  const { startIso, endIso } = getTodayRange();

  if (Platform.OS === "web") {
    return readWebArray<CashbookEntry>(WEB_CASHBOOK_KEY)
      .filter(
        (entry) =>
          entry.is_deleted === 0 &&
          entry.entry_at >= startIso &&
          entry.entry_at < endIso
      )
      .sort(
        (a, b) =>
          new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime()
      );
  }

  const db = await ensureCashbookTable();

  return db.getAllAsync<CashbookEntry>(
    `
    SELECT
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
    FROM cashbook_entries
    WHERE business_id = ?
      AND is_deleted = 0
      AND entry_at >= ?
      AND entry_at < ?
    ORDER BY entry_at DESC;
    `,
    [DEFAULT_BUSINESS_ID, startIso, endIso]
  );
}

export async function getCashbookSummary(): Promise<CashbookSummary> {
  const entries = await getTodayCashbookEntries();
  return buildSummary(entries);
}

export async function getExpenseEntries(): Promise<CashbookEntry[]> {
  const entries = await getCashbookEntries();

  return entries.filter((entry) => entry.entry_type === "expense");
}

export async function createExpense(input: CreateExpenseInput): Promise<void> {
  const category = input.category.trim() || "General";
  const description = input.description.trim();

  if (input.amount <= 0) {
    throw new Error("Expense amount must be greater than 0.");
  }

  if (!description) {
    throw new Error("Expense description is required.");
  }

  const timestamp = nowIso();

  const cashbookEntry: CashbookEntry = {
    id: generateId("cashbook"),
    business_id: DEFAULT_BUSINESS_ID,
    store_id: DEFAULT_STORE_ID,
    entry_type: "expense",
    amount_in: 0,
    amount_out: input.amount,
    description: `${category}: ${description}`,
    ref_type: "expense",
    ref_id: null,
    entry_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    sync_status: "pending",
    is_deleted: 0,
  };

  if (Platform.OS === "web") {
    const entries = readWebArray<CashbookEntry>(WEB_CASHBOOK_KEY);
    writeWebArray(WEB_CASHBOOK_KEY, [cashbookEntry, ...entries]);
    return;
  }

  const db = await ensureCashbookTable();

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
      cashbookEntry.id,
      cashbookEntry.business_id,
      cashbookEntry.store_id,
      cashbookEntry.entry_type,
      cashbookEntry.amount_in,
      cashbookEntry.amount_out,
      cashbookEntry.description,
      cashbookEntry.ref_type,
      cashbookEntry.ref_id,
      cashbookEntry.entry_at,
      cashbookEntry.created_at,
      cashbookEntry.updated_at,
      cashbookEntry.sync_status,
      cashbookEntry.is_deleted,
    ]
  );
}

export async function createDailyClose(
  input: CreateDailyCloseInput
): Promise<DailyClose> {
  if (input.actualCash < 0) {
    throw new Error("Actual cash cannot be negative.");
  }

  const summary = await getCashbookSummary();
  const timestamp = nowIso();

  const dailyClose: DailyClose = {
    id: generateId("daily-close"),
    business_id: DEFAULT_BUSINESS_ID,
    store_id: DEFAULT_STORE_ID,
    expected_cash: summary.expectedCash,
    actual_cash: input.actualCash,
    difference: input.actualCash - summary.expectedCash,
    note: input.note?.trim() || null,
    closed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    sync_status: "pending",
    is_deleted: 0,
  };

  if (Platform.OS === "web") {
    const closes = readWebArray<DailyClose>(WEB_DAILY_CLOSES_KEY);
    writeWebArray(WEB_DAILY_CLOSES_KEY, [dailyClose, ...closes]);
    return dailyClose;
  }

  const db = await ensureDailyCloseTable();

  await db.runAsync(
    `
    INSERT INTO daily_closes (
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
      dailyClose.id,
      dailyClose.business_id,
      dailyClose.store_id,
      dailyClose.expected_cash,
      dailyClose.actual_cash,
      dailyClose.difference,
      dailyClose.note,
      dailyClose.closed_at,
      dailyClose.created_at,
      dailyClose.updated_at,
      dailyClose.sync_status,
      dailyClose.is_deleted,
    ]
  );

  return dailyClose;
}

export async function getDailyCloses(): Promise<DailyClose[]> {
  if (Platform.OS === "web") {
    return readWebArray<DailyClose>(WEB_DAILY_CLOSES_KEY)
      .filter((close) => close.is_deleted === 0)
      .sort(
        (a, b) =>
          new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime()
      );
  }

  const db = await ensureDailyCloseTable();

  return db.getAllAsync<DailyClose>(
    `
    SELECT
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
    FROM daily_closes
    WHERE business_id = ?
      AND is_deleted = 0
    ORDER BY closed_at DESC;
    `,
    [DEFAULT_BUSINESS_ID]
  );
}