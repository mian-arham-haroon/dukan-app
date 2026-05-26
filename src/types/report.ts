export type ReportsSummary = {
  todaySales: number;
  todayPaid: number;
  todayCashIn: number;
  todayCashOut: number;
  todayExpectedCash: number;
  totalUdhaar: number;
  totalStockValue: number;
  lowStockCount: number;
  productCount: number;
  customerCount: number;
  invoiceCount: number;
  recentInvoices: ReportInvoice[];
  lowStockProducts: ReportProduct[];
  invoiceUnpaidTotal: number;
  customerBalanceTotal: number;
  udhaarDifference: number;
  openingBalanceTotal: number;
  expectedCustomerBalance: number;
};

export type ReportInvoice = {
  id: string;
  invoice_no: string;
  customer_name: string;
  payment_status: string;
  return_status?: string;
  grand_total: number;
  returned_total?: number;
  net_total?: number;
  paid_amount: number;
  balance_due: number;
  created_at: string;
  item_summary: string;
};

export type ReportRange = "today" | "yesterday" | "month" | "all";

export type ReportProduct = {
  id: string;
  name: string;
  stock_quantity: number;
  selling_price: number;
  cost_price: number;
  low_stock_alert: number;
};