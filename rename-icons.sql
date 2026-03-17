-- Update workstation icon names from Russian to English
-- This script updates all customIcon values in the locations table

UPDATE locations 
SET custom_fields = jsonb_set(
  custom_fields,
  '{customIcon}',
  to_jsonb('employee.svg'::text)
)
WHERE type = 'workstation' 
  AND custom_fields->>'customIcon' = 'сотрудник.svg';

UPDATE locations 
SET custom_fields = jsonb_set(
  custom_fields,
  '{customIcon}',
  to_jsonb('employee-secure.svg'::text)
)
WHERE type = 'workstation' 
  AND custom_fields->>'customIcon' = 'сотрудник с охранным полем.svg';

UPDATE locations 
SET custom_fields = jsonb_set(
  custom_fields,
  '{customIcon}',
  to_jsonb('workstation-free.svg'::text)
)
WHERE type = 'workstation' 
  AND custom_fields->>'customIcon' = 'раб место свободное.svg';

UPDATE locations 
SET custom_fields = jsonb_set(
  custom_fields,
  '{customIcon}',
  to_jsonb('workstation-free-secure.svg'::text)
)
WHERE type = 'workstation' 
  AND custom_fields->>'customIcon' = 'раб место свободное с охранным полем.svg';

UPDATE locations 
SET custom_fields = jsonb_set(
  custom_fields,
  '{customIcon}',
  to_jsonb('workstation-repair.svg'::text)
)
WHERE type = 'workstation' 
  AND custom_fields->>'customIcon' = 'Рабочее место в работах.svg';

UPDATE locations 
SET custom_fields = jsonb_set(
  custom_fields,
  '{customIcon}',
  to_jsonb('workstation-repair-secure.svg'::text)
)
WHERE type = 'workstation' 
  AND custom_fields->>'customIcon' = 'Рабочее место в работах с охранным полем.svg';

-- Check the results
SELECT COUNT(*) as total_updated FROM locations 
WHERE type = 'workstation' 
  AND custom_fields->>'customIcon' IN (
    'employee.svg',
    'employee-secure.svg',
    'workstation-free.svg',
    'workstation-free-secure.svg',
    'workstation-repair.svg',
    'workstation-repair-secure.svg'
  );
