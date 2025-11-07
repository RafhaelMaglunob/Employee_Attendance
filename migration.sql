-- Migration: Add hybrid enrollment support to employee_fingerprints table
-- Run this in your PostgreSQL database

-- 1. Add enrollment_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='employee_fingerprints' AND column_name='enrollment_type'
    ) THEN
        ALTER TABLE employee_fingerprints 
        ADD COLUMN enrollment_type VARCHAR(20) DEFAULT 'hardware' 
        CHECK (enrollment_type IN ('hardware', 'digital', 'hybrid'));
        
        RAISE NOTICE 'Added enrollment_type column';
    ELSE
        RAISE NOTICE 'enrollment_type column already exists';
    END IF;
END $$;

-- 2. Add fingerprint_data column for storing digital templates (JSONB format)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='employee_fingerprints' AND column_name='fingerprint_data'
    ) THEN
        ALTER TABLE employee_fingerprints 
        ADD COLUMN fingerprint_data JSONB;
        
        RAISE NOTICE 'Added fingerprint_data column';
    ELSE
        RAISE NOTICE 'fingerprint_data column already exists';
    END IF;
END $$;

-- 3. Update status constraint to include 'Pending'
DO $$ 
BEGIN
    -- Drop old constraint if it exists
    ALTER TABLE employee_fingerprints 
    DROP CONSTRAINT IF EXISTS employee_fingerprints_status_check;
    
    -- Add new constraint with 'Pending' status
    ALTER TABLE employee_fingerprints 
    ADD CONSTRAINT employee_fingerprints_status_check 
    CHECK (status IN ('Active', 'Inactive', 'Deleted', 'Pending'));
    
    RAISE NOTICE 'Updated status constraint to include Pending';
END $$;

-- 4. Update existing records to have enrollment_type
UPDATE employee_fingerprints 
SET enrollment_type = 'hardware' 
WHERE enrollment_type IS NULL;

-- 5. Add comments for documentation
COMMENT ON COLUMN employee_fingerprints.enrollment_type IS 'Type of enrollment: hardware (sensor only), digital (simulated), hybrid (digital + hardware)';
COMMENT ON COLUMN employee_fingerprints.fingerprint_data IS 'JSON data containing digital fingerprint template (minutiae, quality score, etc.)';
COMMENT ON COLUMN employee_fingerprints.status IS 'Active: fully enrolled, Pending: awaiting hardware completion, Inactive: disabled, Deleted: removed';

-- 6. Create index for faster queries on pending fingerprints
CREATE INDEX IF NOT EXISTS idx_fingerprint_status_pending 
ON employee_fingerprints(status) 
WHERE status = 'Pending';

-- 7. Add same columns to archive table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='employee_fingerprints_archive' AND column_name='enrollment_type'
    ) THEN
        ALTER TABLE employee_fingerprints_archive 
        ADD COLUMN enrollment_type VARCHAR(20);
        
        RAISE NOTICE 'Added enrollment_type to archive table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='employee_fingerprints_archive' AND column_name='fingerprint_data'
    ) THEN
        ALTER TABLE employee_fingerprints_archive 
        ADD COLUMN fingerprint_data JSONB;
        
        RAISE NOTICE 'Added fingerprint_data to archive table';
    END IF;
END $$;

-- 8. Verify migration
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'employee_fingerprints' 
    AND column_name IN ('enrollment_type', 'fingerprint_data', 'status')
ORDER BY column_name;

-- Show pending fingerprints (should be empty initially)
SELECT 
    ef.employee_id,
    e.fullname,
    ef.fingerprint_slot,
    ef.enrollment_type,
    ef.status,
    ef.registered_at
FROM employee_fingerprints ef
LEFT JOIN employees e ON ef.employee_id = e.employee_id
WHERE ef.status = 'Pending'
ORDER BY ef.registered_at DESC;

DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
END $$;
