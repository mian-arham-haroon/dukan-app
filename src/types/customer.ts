export type Customer = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  opening_balance: number;
  current_balance: number;
  credit_limit: number;
  created_at: string;
  updated_at: string;
  sync_status: string;
  is_deleted: number;
};

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  openingBalance: number;
  creditLimit: number;
};