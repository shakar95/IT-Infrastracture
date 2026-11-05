-- =====================================================================
-- Migration: Make zone_type and floor_level optional & support custom zones
-- Run this in your Supabase SQL Editor if needed:
-- https://supabase.com/dashboard/project/znqjlyqrdcffnlduhtjt/sql/new
-- =====================================================================

-- 1. Relax zone_type on floor_plans to TEXT and allow NULL (Optional)
ALTER TABLE IF EXISTS floor_plans 
  ALTER COLUMN zone_type TYPE TEXT USING zone_type::text,
  ALTER COLUMN zone_type DROP NOT NULL,
  ALTER COLUMN floor_level DROP NOT NULL;

-- 2. Relax placement_zone on devices to TEXT and allow NULL (Optional)
ALTER TABLE IF EXISTS devices 
  ALTER COLUMN placement_zone TYPE TEXT USING placement_zone::text,
  ALTER COLUMN placement_zone DROP NOT NULL;

-- 3. Update Guardrail Trigger so custom zones or NULL values are permitted
CREATE OR REPLACE FUNCTION check_device_placement_guardrail()
RETURNS TRIGGER AS $$
DECLARE
    fp_zone TEXT;
    model_is_rack BOOLEAN;
BEGIN
    -- Fetch BOQ Model constraints
    SELECT is_rack_mounted INTO model_is_rack
    FROM boq_models WHERE id = NEW.boq_model_id;

    -- Validate Rack Mounted requirement
    IF model_is_rack IS TRUE AND (NEW.placement_zone IS NULL OR NEW.placement_zone != 'rack') THEN
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
