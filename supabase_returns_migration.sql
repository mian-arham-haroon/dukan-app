-- Supabase migration for invoice_returns sync
-- Run this SQL in your Supabase project to add support for invoice return records.

create table if not exists invoice_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  store_id uuid not null references stores(id),
  local_id text not null,
  invoice_local_id text not null,
  invoice_item_local_id text,
  product_local_id text,
  product_name text not null,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  refund_amount numeric not null default 0,
  udhaar_reduced numeric not null default 0,
  cash_refund numeric not null default 0,
  note text,
  returned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  unique (business_id, local_id)
);

alter table invoice_returns enable row level security;
create policy "Invoice returns access for business members" on invoice_returns
  for select, insert, update, delete
  using (
    exists (
      select 1
      from business_members bm
      where bm.business_id = invoice_returns.business_id
        and bm.user_id = auth.uid()
    )
  );
