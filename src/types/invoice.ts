export type PaymentStatus = "paid" | "partial" | "unpaid" | "void";

export type InvoiceStatus = "posted" | "void";

export type CreateInvoiceLineInput = {
  productId: string;
  quantity: number;
};

export type CreateInvoiceInput = {
  customerId?: string | null;
  lines: CreateInvoiceLineInput[];
  paymentStatus: PaymentStatus;
  paidAmount: number;
};

export type InvoiceListItem = {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  customer_name: string;
  status?: InvoiceStatus;
  payment_status: PaymentStatus;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  created_at: string;
  item_summary: string;
  item_count: number;
};