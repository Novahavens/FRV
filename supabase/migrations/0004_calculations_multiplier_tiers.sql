-- The multiplier schedule used for a calculation, stored with it.
-- Multipliers are editable per claim from October 2026, so the report's
-- "multipliers applied" table must come from the row, not from code constants
-- that may have moved since. JSON array of { "maxMonths": int|null, "multiplier": number },
-- ascending, last maxMonths null = open-ended. Null on rows written before this
-- column existed; readers fall back to the schedule in force at the time.
alter table calculations add column if not exists multiplier_tiers jsonb;
