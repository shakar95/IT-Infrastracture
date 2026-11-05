-- =====================================================================
-- Migration: Add project_id and relax Indoor/Outdoor placement restriction
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/znqjlyqrdcffnlduhtjt/sql/new
-- =====================================================================

-- 1. Add project_id column to tables
ALTER TABLE IF EXISTS floor_plans 
ADD COLUMN IF NOT EXISTS project_id TEXT DEFAULT 'proj-sitak';

ALTER TABLE IF EXISTS devices 
ADD COLUMN IF NOT EXISTS project_id TEXT DEFAULT 'proj-sitak';

ALTER TABLE IF EXISTS boq_models 
ADD COLUMN IF NOT EXISTS project_id TEXT DEFAULT 'proj-sitak';

-- 2. Update Smart Placement Guardrail trigger:
-- Indoor / Outdoor now purely specifies the location rather than blocking placement!
CREATE OR REPLACE FUNCTION check_device_placement_guardrail()
RETURNS TRIGGER AS $$
DECLARE
    fp_zone zone_type;
    model_is_rack BOOLEAN;
BEGIN
    -- Fetch BOQ Model constraints
    SELECT is_rack_mounted INTO model_is_rack
    FROM boq_models WHERE id = NEW.boq_model_id;

    -- Validate Rack Mounted requirement
    IF model_is_rack IS TRUE AND NEW.placement_zone != 'rack' THEN
        RAISE EXCEPTION '[Guardrail Error / هەڵەی شوێن]: Rack-mounted device cannot be placed outside a Server Rack zone! (ئەم ئامێرە مۆدی ڕاکە و پێویستە تەنها لە ڕاکدا دابنرێت)';
    END IF;

    -- Floor Plan Zone is informational (specifies location, does not block)
    IF NEW.floor_plan_id IS NOT NULL AND NEW.placement_zone IS NULL THEN
        SELECT zone_type INTO fp_zone FROM floor_plans WHERE id = NEW.floor_plan_id;
        IF fp_zone IS NOT NULL THEN
            NEW.placement_zone := fp_zone;
        END IF;
    END IF;

    -- Prevent Duplicate Active IP Address (if IP is specified)
    IF NEW.ip_address IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM devices 
            WHERE ip_address = NEW.ip_address 
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            RAISE EXCEPTION '[IP Conflict / دژایەتی ئایپی]: IP Address % is already assigned to another device! (ئەم ئایپییە پێشتر بەکارهاتووە)', NEW.ip_address;
        END IF;
    END IF;

    -- Prevent Duplicate Switch Port on same switch
    IF NEW.switch_name IS NOT NULL AND NEW.switch_port IS NOT NULL AND NEW.switch_port != '' THEN
        IF EXISTS (
            SELECT 1 FROM devices 
            WHERE switch_name = NEW.switch_name 
              AND switch_port = NEW.switch_port 
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            RAISE EXCEPTION '[Port Conflict / دژایەتی پۆرت]: Switch port % on % is already patched to another device! (ئەم پۆرتە بەکارهاتووە)', NEW.switch_port, NEW.switch_name;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
