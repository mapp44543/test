-- ===========================
-- Complete Database Schema
-- All migrations combined
-- ===========================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- 1. Table: admins
-- =========================================
CREATE TABLE IF NOT EXISTS admins (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar NOT NULL UNIQUE,
    password varchar NOT NULL,
    role varchar NOT NULL DEFAULT 'admin',
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- =========================================
-- 2. Table: sessions
-- =========================================
CREATE TABLE IF NOT EXISTS sessions (
    sid varchar PRIMARY KEY,
    sess jsonb NOT NULL,
    expire timestamp NOT NULL
);

-- =========================================
-- 3. Table: public_links
-- =========================================
CREATE TABLE IF NOT EXISTS public_links (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar NOT NULL,
    url text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_public_links_sort_order ON public_links(sort_order);

-- =========================================
-- 4. Table: floors
-- =========================================
CREATE TABLE IF NOT EXISTS floors (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar NOT NULL UNIQUE,
    name varchar,
    image_url text,
    mime_type varchar,
    sort_order integer DEFAULT 0,
    show_in_public boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_floors_sort_order ON floors(sort_order);
CREATE INDEX IF NOT EXISTS idx_floors_mime_type ON floors(mime_type);

-- =========================================
-- 5. Table: locations
-- =========================================
CREATE TABLE IF NOT EXISTS locations (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar NOT NULL,
    type varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'available',
    floor varchar NOT NULL DEFAULT '5',
    floor_id varchar REFERENCES floors(id) ON DELETE SET NULL,
    capacity integer,
    equipment text,
    employee varchar,
    inventory_id varchar,
    description text,
    x real NOT NULL,
    y real NOT NULL,
    width real NOT NULL DEFAULT 80,
    height real NOT NULL DEFAULT 60,
    custom_fields jsonb DEFAULT '{}',
    custom_color varchar(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_floor_id ON locations(floor_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);

-- =========================================
-- 6. Table: avatars
-- =========================================
CREATE TABLE IF NOT EXISTS avatars (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id varchar NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    original_name varchar NOT NULL,
    mime_type varchar NOT NULL,
    size integer NOT NULL,
    data text NOT NULL,
    thumbnail_data text,
    width integer,
    height integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_avatars_location_id ON avatars(location_id);

-- =========================================
-- 7. Table: markers
-- =========================================
CREATE TABLE IF NOT EXISTS markers (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id varchar NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    key varchar NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_markers_location_id ON markers(location_id);
CREATE INDEX IF NOT EXISTS idx_markers_key ON markers(key);

-- =========================================
-- 8. Function and triggers for updated_at
-- =========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply triggers
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('public_links', 'floors', 'locations', 'avatars', 'markers') LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- Set default value for existing common-area locations
UPDATE locations SET custom_color = 'emerald' WHERE type = 'common-area' AND custom_color IS NULL;
