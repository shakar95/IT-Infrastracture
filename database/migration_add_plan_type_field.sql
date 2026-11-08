-- =====================================================================
-- Migration: Add 'plan_type' column to floor_plans
-- Allows selecting blueprint discipline: 'ICT', 'Security', 'AV', 'BMS'
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/znqjlyqrdcffnlduhtjt/sql/new
-- =====================================================================

-- 1. Add plan_type column to floor_plans table (defaulting to 'ICT')
ALTER TABLE IF EXISTS floor_plans 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'ICT';

-- 2. Populate all existing floor plans with 'ICT'
UPDATE floor_plans 
SET plan_type = 'ICT' 
WHERE plan_type IS NULL OR plan_type = '';

-- 3. Verify the updated records
SELECT id, name, name_ku, plan_type, zone, floor_level FROM floor_plans;

