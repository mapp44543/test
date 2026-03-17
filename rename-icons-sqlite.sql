-- SQLite Icon Migration Script
-- Updates all workstation icon references from Russian names to English names
-- Usage: sqlite3 storage.db < rename-icons-sqlite.sql

-- Update сотрудник.svg → employee.svg
UPDATE locations 
SET custom_fields = json_set(
  COALESCE(custom_fields, '{}'),
  '$.customIcon',
  'employee.svg'
)
WHERE type = 'workstation' 
  AND json_extract(custom_fields, '$.customIcon') = 'сотрудник.svg';

-- Update сотрудник с охранным полем.svg → employee-secure.svg
UPDATE locations 
SET custom_fields = json_set(
  COALESCE(custom_fields, '{}'),
  '$.customIcon',
  'employee-secure.svg'
)
WHERE type = 'workstation' 
  AND json_extract(custom_fields, '$.customIcon') = 'сотрудник с охранным полем.svg';

-- Update раб место свободное.svg → workstation-free.svg
UPDATE locations 
SET custom_fields = json_set(
  COALESCE(custom_fields, '{}'),
  '$.customIcon',
  'workstation-free.svg'
)
WHERE type = 'workstation' 
  AND json_extract(custom_fields, '$.customIcon') = 'раб место свободное.svg';

-- Update раб место свободное с охранным полем.svg → workstation-free-secure.svg
UPDATE locations 
SET custom_fields = json_set(
  COALESCE(custom_fields, '{}'),
  '$.customIcon',
  'workstation-free-secure.svg'
)
WHERE type = 'workstation' 
  AND json_extract(custom_fields, '$.customIcon') = 'раб место свободное с охранным полем.svg';

-- Update Рабочее место в работах.svg → workstation-repair.svg
UPDATE locations 
SET custom_fields = json_set(
  COALESCE(custom_fields, '{}'),
  '$.customIcon',
  'workstation-repair.svg'
)
WHERE type = 'workstation' 
  AND json_extract(custom_fields, '$.customIcon') = 'Рабочее место в работах.svg';

-- Update Рабочее место в работах с охранным полем.svg → workstation-repair-secure.svg
UPDATE locations 
SET custom_fields = json_set(
  COALESCE(custom_fields, '{}'),
  '$.customIcon',
  'workstation-repair-secure.svg'
)
WHERE type = 'workstation' 
  AND json_extract(custom_fields, '$.customIcon') = 'Рабочее место в работах с охранным полем.svg';

-- Verify results
SELECT '✓ Migration complete. Locations with custom icons:' as status;
SELECT id, name, json_extract(custom_fields, '$.customIcon') as customIcon
FROM locations
WHERE type = 'workstation'
AND json_extract(custom_fields, '$.customIcon') IS NOT NULL
ORDER BY name;
