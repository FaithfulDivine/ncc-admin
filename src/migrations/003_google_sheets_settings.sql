-- Migration: Add Google Sheets / Auto Fulfillment settings to system_settings
-- Purpose: Store Service Account credentials + Sheet config in Supabase
-- so it works both locally and on Vercel deployment

-- Insert default Google Sheets settings
-- These will be updated via the Settings UI
INSERT INTO system_settings (key, value, category, label, setting_type)
VALUES
  ('GSHEET_SERVICE_ACCOUNT_JSON', '', 'Google Sheets', 'Service Account JSON (full JSON content)', 'json'),
  ('GSHEET_ORDER_SHEET_ID', '', 'Google Sheets', 'Order Google Sheet ID', 'text'),
  ('GSHEET_DATA_PNG_SHEET_ID', '', 'Google Sheets', 'Data PNG Google Sheet ID', 'text'),
  ('GSHEET_ORDER_TAB', 'order', 'Google Sheets', 'Order tab name', 'text'),
  ('GSHEET_PASTERORDERS_TAB', 'pasterorders', 'Google Sheets', 'Paster Orders tab name', 'text'),
  ('GSHEET_DATA_PNG_TAB', 'Sheet1', 'Google Sheets', 'Data PNG tab name', 'text'),
  ('GSHEET_FIELD_MAPPING', '{"orderNumber":"A","itemCode":"B","trackingNumber":"C","carrier":"D","fulfillmentStatus":"E"}', 'Google Sheets', 'Field mapping (Shopify → Sheet columns)', 'json')
ON CONFLICT (key) DO NOTHING;
