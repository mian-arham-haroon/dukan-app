export type CloudProfile = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export type CloudBusiness = {
  id: string;
  owner_id: string;
  name: string;
  currency: string;
  country: string;
  created_at: string;
  updated_at: string;
};

export type CloudStore = {
  id: string;
  business_id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CloudBusinessContext = {
  business: CloudBusiness | null;
  store: CloudStore | null;
  role: string | null;
};