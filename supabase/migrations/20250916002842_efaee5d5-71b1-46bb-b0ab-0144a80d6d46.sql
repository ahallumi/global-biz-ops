-- Add default_page column to station_login_codes table
ALTER TABLE public.station_login_codes 
ADD COLUMN default_page text DEFAULT '/station';