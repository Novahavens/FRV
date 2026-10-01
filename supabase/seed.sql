-- Coppell reference claim, locked at version 1.
-- Seeds the exact figures from PRD 12.1 so a fresh environment renders a real
-- report immediately and `npm run dev` is useful before any intake exists.

insert into claims (
  id, claim_identifier, address, lat, lng, bedrooms, bathrooms, sqft,
  term_months, mgmt_fee_cents, status, sourcing_unlocked, created_by, locked_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'NH-2026-0417-A',
  '205 Park Meadow Way, Coppell TX 75019',
  32.9668, -96.9903, 4, 2.0, 2100, 3, 24000,
  'locked', true, 'seed@novahavens.com', now()
) on conflict (id) do nothing;

insert into comps (claim_id, url, address, rent_cents, bedrooms, bathrooms, sqft, furnished, lat, lng, distance_mi, sort_position)
values
  ('00000000-0000-4000-8000-000000000001',
   'https://www.zillow.com/homedetails/1052-Village-Pkwy-Coppell-TX-75019/26965000_zpid/',
   '1052 Village Pkwy, Coppell TX 75019', 383500, 4, 2.0, 2250, false, 32.9674, -96.9911, 0.50, 0),
  ('00000000-0000-4000-8000-000000000001',
   'https://www.zillow.com/homedetails/318-Woodhurst-Dr-Coppell-TX-75019/26965111_zpid/',
   '318 Woodhurst Dr, Coppell TX 75019', 360000, 4, 2.5, 2100, false, 32.9701, -96.9884, 0.30, 1),
  ('00000000-0000-4000-8000-000000000001',
   'https://www.zillow.com/homedetails/744-Bethel-School-Rd-Coppell-TX-75019/26965222_zpid/',
   '744 Bethel School Rd, Coppell TX 75019', 320000, 4, 2.0, 1900, false, 32.9622, -96.9952, 0.50, 2)
on conflict do nothing;

-- Figures exactly as PRD 12.1 states them.
insert into calculations (
  claim_id, version, multiplier, furniture_cents, mgmt_fee_cents,
  per_comp_frv_cents, averaged_base_rent_cents, averaged_frv_cents, frv_12mo_cents
) values (
  '00000000-0000-4000-8000-000000000001', 1, 1.30, 160000, 24000,
  array[682550, 652000, 600000], 354500, 644850, 378500
) on conflict (claim_id, version) do nothing;
