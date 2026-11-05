-- =====================================================================
-- Migration: Add 'zone' column to floor_plans and devices
-- (Main Villa, Guest House, Service Area, etc.)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/znqjlyqrdcffnlduhtjt/sql/new
-- =====================================================================

-- 1. Add zone column to floor_plans
ALTER TABLE IF EXISTS floor_plans 
ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'main_villa';

-- 2. Add zone column to devices
ALTER TABLE IF EXISTS devices 
ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'main_villa';

-- 3. Populate existing records with defaults if null
UPDATE floor_plans SET zone = 'main_villa' WHERE zone IS NULL;
UPDATE devices SET zone = 'main_villa' WHERE zone IS NULL;

