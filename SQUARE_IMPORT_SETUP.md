# Square Import Production Setup Guide

## Required Environment Variables

Set these environment variables in Supabase Dashboard → Functions → Settings:

```bash
# Core Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
APP_ENV=prod

# Square API Configuration  
SQUARE_API_BASE=https://connect.squareup.com/v2

# Import Performance Tuning
IMPORT_MAX_SECONDS=50          # Function execution time budget
IMPORT_PAGE_SIZE=100           # Square API page size (recommended: 100)

# Watchdog Configuration
WATCHDOG_RUNNING_MIN=15        # Mark RUNNING imports stale after X minutes
WATCHDOG_PENDING_MIN=5         # Mark PENDING imports stale after X minutes
```

## Scheduled Watchdog Setup

### Option 1: Supabase Scheduler (Recommended)
```bash
# Create scheduled function call every 10 minutes
supabase functions schedule create import-watchdog-cron \
  --cron "*/10 * * * *" \
  --endpoint "/functions/v1/import-watchdog"
```

### Option 2: Manual Cron Job
Add to your server's crontab:
```bash
# Every 10 minutes
*/10 * * * * curl -X POST "https://your-project.supabase.co/functions/v1/import-watchdog" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Final Smoke Test Checklist

### 1. Environment Verification
- [ ] All environment variables set in Supabase Functions
- [ ] SQUARE_API_BASE points to correct environment (sandbox vs production)
- [ ] Square access token configured and working

### 2. Import Flow Test
```bash
# Start an import
curl -X POST "https://your-project.supabase.co/functions/v1/square-import-products" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"integrationId":"YOUR_INTEGRATION_ID","mode":"START"}'
```

Expected flow: PENDING → RUNNING → SUCCESS (or PARTIAL if large catalog)

### 3. Status Verification
Check `product_import_runs` table:
- [ ] `processed_count > 0` (not stuck at 0)
- [ ] Merchant info logged in `errors` array with "INFO" code
- [ ] No "CREDENTIALS" or "KICKSTART" errors

### 4. Watchdog Test
```bash
# Test watchdog function
curl -X POST "https://your-project.supabase.co/functions/v1/import-watchdog" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Expected response: `{"ok": true, "updated": N, "details": [...]}`

### 5. Abort Test
```bash
# Test abort function
curl -X POST "https://your-project.supabase.co/functions/v1/import-abort" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"integrationId":"YOUR_INTEGRATION_ID"}'
```

### 6. UI Status Labels
Verify these status labels appear correctly:
- PENDING → "Queued"
- RUNNING → "Importing…"  
- PARTIAL → "Continuing…" (not "Queued")
- SUCCESS → "Done"
- FAILED → "Failed"

### 7. Idempotent Re-runs
- [ ] Re-running same import doesn't duplicate products
- [ ] Updated products reflect latest Square data
- [ ] Variations are properly linked to parent items

## Troubleshooting

### Import Shows 0 Processed Items
1. Check merchant info in errors array - verify correct environment
2. Verify Square token has catalog read permissions
3. Check if Square catalog is actually empty

### "Queued" Forever (Stuck in PENDING)
1. Run watchdog to clean stale runs
2. Verify selfInvoke URL construction in edge function
3. Check function execution logs for errors

### Performance Issues
1. Reduce `IMPORT_PAGE_SIZE` to 50 if hitting rate limits
2. Increase `IMPORT_MAX_SECONDS` for very large catalogs
3. Monitor database indexes are being used

### Rate Limiting
Square API allows:
- 1000 requests per minute for catalog endpoints
- Backoff strategy implemented in code handles 429 responses

## Security Notes

The following database indexes were added for performance:
- `product_pos_links (source, pos_item_id, pos_variation_id)`
- `products (sku, upc)`
- `product_import_runs (status, last_progress_at)`

All functions use service role key and proper RLS policies are in place.