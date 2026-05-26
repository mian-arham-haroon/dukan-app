export type Product = {
  id: string;
  business_id: string;
  store_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  sync_status: string;
  low_stock_alert?: number;
  is_deleted: number;
};

export type CreateProductInput = {
  name: string;
  sku?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  category?: string;
  unit?: string;
};