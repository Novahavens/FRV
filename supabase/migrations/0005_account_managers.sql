-- "Prepared by" on an FRV is chosen from a list, not typed, so the audit trail
-- carries one spelling per person. The list is a table so a name can be added
-- or retired (active = false) without a deploy. Retired names stay in the table
-- so history is never rewritten; claims.created_by keeps the text it was given.
create table account_managers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table account_managers enable row level security;

-- Same posture as the other tables: the app uses the service role.
create policy account_managers_read on account_managers for select using (true);

-- Seeded here (not in seed.sql) because the form is unusable with an empty list.
insert into account_managers (name, sort_order) values
  ('Fazal Abed', 10),
  ('William', 20),
  ('Louise Jaffe', 30)
on conflict (name) do nothing;
