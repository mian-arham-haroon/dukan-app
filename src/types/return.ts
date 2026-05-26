export type ReturnInvoiceLineInput = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type CreateInvoiceReturnInput = {
  invoiceId: string;
  lines: ReturnInvoiceLineInput[];
  note?: string;
};

export type InvoiceReturnLine = {
  id: string;
  invoice_id: string;
  invoice_item_local_id?: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  balance_reduced: number;
  cash_refund: number;
  note: string | null;
  created_at: string;
  updated_at?: string;
};

export type ReturnPreviewLine = {
  productId: string | null;
  productName: string;
  soldQuantity: number;
  alreadyReturnedQuantity: number;
  maxReturnQuantity: number;
  unitPrice: number;
};

export type InvoiceReturnPreview = {
  invoiceId: string;
  invoiceNo: string;
  customerId: string | null;
  customerName: string;
  paymentStatus: string;
  balanceDue: number;
  paidAmount: number;
  lines: ReturnPreviewLine[];
};