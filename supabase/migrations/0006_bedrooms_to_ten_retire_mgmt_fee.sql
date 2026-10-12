-- October 2026 (Lou, via Fazal).
--
-- 1. Loss bedrooms widen from 1–5 to 1–10. Furniture rates for 6–10 live in
--    src/lib/frv/constants.ts; this constraint must match the rate table.
-- 2. The management fee is retired. New claims store 0. The column stays, so
--    claims locked before the change keep the fee they were calculated with.
--
-- Widening a check and changing a default touch no existing row, so the
-- lock triggers on locked claims are not engaged.

alter table claims drop constraint claims_bedrooms_check;
alter table claims add constraint claims_bedrooms_check check (bedrooms between 1 and 10);

alter table claims alter column mgmt_fee_cents set default 0;
