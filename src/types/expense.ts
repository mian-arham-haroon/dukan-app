export type CreateExpenseInput = {
  category: string;
  amount: number;
  description: string;
};

export type CashbookEntry = {
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
  sync_status: "pending" | "synced" | "failed";
  is_deleted: number;
};

export type CashbookSummary = {
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  expenseTotal: number;
  entryCount: number;
};

export type CreateDailyCloseInput = {
  actualCash: number;
  note?: string;
};

export type DailyClose = {
  id: string;
  business_id: string;
  store_id: string;
  expected_cash: number;
  actual_cash: number;
  difference: number;
  note: string | null;
  closed_at: string;
  created_at: string;
  updated_at: string;
  sync_status: "pending" | "synced" | "failed";
  is_deleted: number;
};