-- =====================================================================
-- Migration: Remove AI Placement Guardrail Triggers & Functions
-- Gives users 100% freedom to place any device on any floor plan without AI check blocks
-- =====================================================================

-- 1. Drop the device placement guardrail trigger if it exists
DROP TRIGGER IF EXISTS trg_device_guardrail ON devices;

-- 2. Drop the guardrail function
DROP FUNCTION IF EXISTS check_device_placement_guardrail();

-- 3. Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

