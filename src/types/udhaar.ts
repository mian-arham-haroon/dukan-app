export type UdhaarCustomer = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
  credit_limit: number;
};

export type UdhaarLedgerEntry = {
  id: string;
  customer_id: string;
  type: "invoice" | "payment";
  title: string;
  description: string;
  amount: number;
  created_at: string;
};

export type ReceiveCustomerPaymentInput = {
  customerId: string;
  amount: number;
  note?: string;
};