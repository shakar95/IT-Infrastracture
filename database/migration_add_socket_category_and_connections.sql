-- =====================================================================
-- Migration: Add Sockets Category, Allow Blank Labels, & Add Uplink/Connection Fields
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/znqjlyqrdcffnlduhtjt/sql/new
-- =====================================================================

-- 1. Relax custom_label_id on devices table:
-- Allow devices to be created without a label (Blank / NULL), without auto-generating fake labels.
ALTER TABLE IF EXISTS devices 
  ALTER COLUMN custom_label_id DROP NOT NULL;

-- Drop strict unique constraint that blocked empty strings / duplicate blanks
ALTER TABLE IF EXISTS devices 
  DROP CONSTRAINT IF EXISTS devices_custom_label_id_key;

-- Re-create unique index only on non-empty, non-null labels
DROP INDEX IF EXISTS devices_custom_label_id_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS devices_custom_label_id_unique_idx 
ON devices (custom_label_id) 
WHERE custom_label_id IS NOT NULL 
  AND custom_label_id != '' 
  AND custom_label_id NOT LIKE 'UNLABELED-%';

-- Convert any fallback placeholders to clean NULLs
UPDATE devices 
SET custom_label_id = NULL 
WHERE custom_label_id LIKE 'UNLABELED-%' OR custom_label_id = '';

-- 2. Add connection columns to devices table:
-- Supports connecting directly to Sockets (سۆکێت), Patch Panels (پاچ پەناڵ), or Switches (سویچ)
ALTER TABLE IF EXISTS devices 
  ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'switch',
  ADD COLUMN IF NOT EXISTS connected_socket_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connected_socket_label TEXT,
  ADD COLUMN IF NOT EXISTS connected_socket_model_id UUID REFERENCES boq_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patch_panel_name TEXT,
  ADD COLUMN IF NOT EXISTS patch_panel_port TEXT;

-- 3. Ensure 'Sockets & Outlets' Category exists in categories table
INSERT INTO categories (
  id,
  name,
  name_ku,
  description,
  icon_name,
  color_code,
  allowed_zones,
  custom_schema
) VALUES (
  '10000000-0000-0000-0000-000000000016',
  'Sockets & Outlets',
  'سۆکێت و دەرچەکان',
  'Data sockets, RJ45 Cat6/Cat6A faceplates, power outlets, keystone jacks & floor boxes',
  'Plug',
  '#10B981',
  ARRAY['indoor', 'outdoor', 'rack', 'safe_room']::zone_type[],
  '[{"key": "socket_type", "label": "Socket Type (Single/Dual RJ45, Data/Power)", "type": "text"}, {"key": "port_count", "label": "Ports / Keystones", "type": "number"}]'::jsonb
)
ON CONFLICT (name) DO UPDATE 
SET 
  name_ku = EXCLUDED.name_ku,
  icon_name = EXCLUDED.icon_name,
  color_code = EXCLUDED.color_code,
  allowed_zones = EXCLUDED.allowed_zones,
  custom_schema = EXCLUDED.custom_schema;

-- 4. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Verification output
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'devices' 
  AND column_name IN ('custom_label_id', 'connection_type', 'connected_socket_id', 'patch_panel_name');
