export type InvoicePrintLine = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  returned_quantity?: number;
};

export type InvoicePrintData = {
  id: string;
  local_id?: string;
  invoice_no: string;
  customer_name: string;
  payment_status: string;
  return_status?: string;
  original_total?: number;
  returned_total?: number;
  net_total?: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  created_at: string;
  item_summary: string;
  lines: InvoicePrintLine[];
};