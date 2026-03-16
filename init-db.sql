-- Drop database office_map if exists (with disconnect)
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'office_map'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS office_map;

-- Simply try to drop the role, ignoring if it can't be done
DO $$ 
BEGIN
  EXECUTE 'DROP ROLE IF EXISTS office_user';
EXCEPTION WHEN OTHERS THEN
  -- If drop fails, continue - we'll handle it below
  NULL;
END $$;

-- Force drop the role even if it has dependencies
DO $$ 
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='office_user') THEN
    -- Give ownership of everything to postgres
    REASSIGN OWNED BY office_user TO postgres;
    -- Drop everything owned by office_user
    DROP OWNED BY office_user;
    -- Now we can drop the role
    DROP ROLE office_user;
  END IF;
END $$;

-- Create role office_user with password
CREATE ROLE office_user WITH LOGIN PASSWORD '85RfaWC0uPPs2OP1HaBdN1';

-- Give role the ability to create databases
ALTER ROLE office_user WITH CREATEDB;

-- Create database office_map
CREATE DATABASE office_map OWNER office_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE office_map TO office_user;
