-- Add performance indexes for Square import system
create index if not exists idx_product_pos_links_source_pos_ids
  on public.product_pos_links (source, pos_item_id, pos_variation_id);

create index if not exists idx_products_sku_upc 
  on public.products (sku, upc);

create index if not exists idx_inventory_integrations_environment
  on public.inventory_integrations (environment);

-- Add cursor column to product_import_runs if it doesn't exist  
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'product_import_runs' and column_name = 'cursor') then
    alter table public.product_import_runs add column cursor text;
  end if;
end $$;