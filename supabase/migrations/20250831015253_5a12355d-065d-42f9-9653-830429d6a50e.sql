-- Performance indexes for Square import optimization
create index if not exists product_pos_links_integration_pos_idx
  on public.product_pos_links (source, pos_item_id, pos_variation_id);

create index if not exists products_sku_idx
  on public.products (sku);

create index if not exists products_upc_idx
  on public.products (upc);

-- Additional import-specific indexes for fast lookups
create index if not exists product_import_runs_status_progress_idx
  on public.product_import_runs (status, last_progress_at desc);

create index if not exists inventory_integrations_provider_idx
  on public.inventory_integrations (provider, created_at desc);