
-- 1) Create catalog_status enum and add column to products
do $$
begin
  create type catalog_status as enum ('ACTIVE','PLACEHOLDER','ARCHIVED');
exception
  when duplicate_object then null;
end $$;

alter table public.products
  add column if not exists catalog_status catalog_status not null default 'ACTIVE';

-- Helpful index for filtering
create index if not exists idx_products_catalog_status on public.products (catalog_status);

-- 2) Heuristic backfill to quarantine obvious intake placeholders
-- Criteria:
-- - No POS link in product_pos_links
-- - No retail and no default cost
-- - Origin is LOCAL (so we don't touch SQUARE/merged items)
update public.products p
set catalog_status = 'PLACEHOLDER'
where p.catalog_status = 'ACTIVE'
  and p.origin = 'LOCAL'
  and not exists (
    select 1
    from public.product_pos_links l
    where l.product_id = p.id
  )
  and coalesce(p.retail_price_cents, 0) = 0
  and coalesce(p.default_cost_cents, 0) = 0;

-- 3) Add explicit auto_push_enabled flag to inventory_integrations
alter table public.inventory_integrations
  add column if not exists auto_push_enabled boolean not null default false;
