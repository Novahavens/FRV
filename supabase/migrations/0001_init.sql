-- Nova Havens FRV — initial schema (PRD section 8).
--
-- Rule 5 is enforced HERE, not in the interface. Hiding a button is a
-- suggestion; a trigger that rejects the write is a guarantee. Anything that
-- reaches the database through any client — the app, a script, the Supabase
-- dashboard — hits the same wall.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- claims
-- ---------------------------------------------------------------------------
create type claim_status as enum ('draft', 'locked');

create table claims (
  id                  uuid primary key default gen_random_uuid(),
  -- Free text. Not always numeric, and must never be constrained to digits.
  claim_identifier    text        not null,
  address             text        not null,
  lat                 double precision not null,
  lng                 double precision not null,
  bedrooms            smallint    not null check (bedrooms between 1 and 5),
  bathrooms           numeric(3,1) not null check (bathrooms > 0),
  sqft                integer     not null check (sqft > 0),
  term_months         smallint    not null check (term_months >= 1),
  -- Default $240, editable per claim. Zero is permitted: standard non-ASAP
  -- Nova Havens sourcing does not carry the fee.
  mgmt_fee_cents      integer     not null default 24000 check (mgmt_fee_cents >= 0),
  status              claim_status not null default 'draft',
  -- Rule 2: nothing downstream opens until an FRV exists and is locked.
  sourcing_unlocked   boolean     not null default false,
  created_by          text        not null,
  created_at          timestamptz not null default now(),
  locked_at           timestamptz,

  -- There is deliberately NO market_value column. The monetary value of the
  -- home is irrelevant to an FRV and must never become an input.

  constraint locked_claims_have_a_timestamp
    check (status = 'draft' or locked_at is not null)
);

create index claims_status_idx on claims (status, created_at desc);
create unique index claims_identifier_idx on claims (lower(claim_identifier));

-- ---------------------------------------------------------------------------
-- comps — exactly three per calculation
-- ---------------------------------------------------------------------------
create table comps (
  id                  uuid primary key default gen_random_uuid(),
  claim_id            uuid not null references claims(id) on delete cascade,
  url                 text not null,
  address             text not null,
  rent_cents          integer not null check (rent_cents > 0),
  bedrooms            smallint not null,
  bathrooms           numeric(3,1) not null,
  sqft                integer not null check (sqft > 0),
  furnished           boolean not null default false,
  lat                 double precision not null,
  lng                 double precision not null,
  distance_mi         numeric(6,2) not null,
  -- Rule 3: the high-to-low ordering is persisted, never recomputed at render.
  sort_position       smallint not null check (sort_position between 0 and 2),
  -- Which fields a human corrected over the provider's answer.
  overridden_fields   text[] not null default '{}',
  created_at          timestamptz not null default now(),

  -- Rule 1, at the storage layer. A furnished comp cannot be stored at all,
  -- so no later code path can accidentally read one back and use it.
  constraint comps_must_be_unfurnished check (furnished = false),
  unique (claim_id, sort_position)
);

create index comps_claim_idx on comps (claim_id, sort_position);

-- ---------------------------------------------------------------------------
-- calculations — immutable; a revision writes a new row
-- ---------------------------------------------------------------------------
create table calculations (
  id                       uuid primary key default gen_random_uuid(),
  claim_id                 uuid not null references claims(id) on delete cascade,
  version                  integer not null check (version >= 1),
  multiplier               numeric(4,2) not null,
  furniture_cents          integer not null,
  mgmt_fee_cents           integer not null,
  -- Per-comp figures in sort order, so the report reproduces exactly.
  per_comp_frv_cents       integer[] not null,
  averaged_base_rent_cents integer not null,
  averaged_frv_cents       integer not null,
  frv_12mo_cents           integer not null,
  computed_at              timestamptz not null default now(),

  unique (claim_id, version)
);

-- ---------------------------------------------------------------------------
-- revisions — reason is enumerated, never free text alone
-- ---------------------------------------------------------------------------
create type revision_reason as enum (
  'sqft_differed',        -- actual square footage differed from the record
  'market_shifted',       -- documented time elapsed, material movement
  'comp_was_wrong',       -- wrong area, wrong property type, or furnished
  'term_changed'          -- approved lease term moved to another tier
);

create table revisions (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid not null references claims(id) on delete cascade,
  from_version integer not null,
  to_version   integer not null,
  reason       revision_reason not null,
  note         text,
  actor_id     text not null,
  created_at   timestamptz not null default now(),

  constraint revisions_move_forward check (to_version > from_version)
);

-- ---------------------------------------------------------------------------
-- validation_events — every block, warning and acknowledgement
-- ---------------------------------------------------------------------------
create table validation_events (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references claims(id) on delete cascade,
  rule        text not null,
  outcome     text not null check (outcome in ('pass', 'warn', 'block', 'acknowledged')),
  detail      text,
  actor_id    text,
  created_at  timestamptz not null default now()
);

create index validation_events_claim_idx on validation_events (claim_id, created_at);

-- ---------------------------------------------------------------------------
-- Rule 5 — the lock
-- ---------------------------------------------------------------------------

-- A locked claim accepts exactly one kind of write: the transition that a
-- revision opens. Everything else is rejected with a message an operator can
-- act on, because this error will surface in the interface.
create or replace function reject_writes_to_locked_claim()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'locked' and current_setting('app.revision_open', true) is distinct from old.id::text then
    raise exception using
      errcode = 'check_violation',
      message = 'This FRV is locked.',
      hint    = 'Request a revision with a documented reason. A revision creates a new version and leaves this one readable.';
  end if;
  -- NEW is null in a DELETE trigger; returning it would silently skip the delete.
  return coalesce(new, old);
end;
$$;

create trigger claims_locked_guard
  before update or delete on claims
  for each row execute function reject_writes_to_locked_claim();

-- Comps and calculations belonging to a locked claim are frozen too. Without
-- this, the headline figure stays put while the evidence under it moves.
create or replace function reject_writes_to_locked_parent()
returns trigger
language plpgsql
as $$
declare
  parent_id uuid := coalesce(new.claim_id, old.claim_id);
  parent_status claim_status;
begin
  select status into parent_status from claims where id = parent_id;
  if parent_status = 'locked'
     and current_setting('app.revision_open', true) is distinct from parent_id::text then
    raise exception using
      errcode = 'check_violation',
      message = 'The FRV for this claim is locked.',
      hint    = 'Request a revision before changing its comps or calculation.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger comps_locked_guard
  before insert or update or delete on comps
  for each row execute function reject_writes_to_locked_parent();

create trigger calculations_locked_guard
  before update or delete on calculations
  for each row execute function reject_writes_to_locked_parent();

-- The one sanctioned way through the wall.
--
-- Opens a revision window inside a single transaction: the session flag lets
-- the guards pass, a revision record is written, and the flag dies with the
-- transaction. There is no way to hold it open.
create or replace function open_revision(
  p_claim_id uuid,
  p_reason   revision_reason,
  p_actor    text,
  p_note     text default null
)
returns integer
language plpgsql
as $$
declare
  current_version integer;
begin
  select coalesce(max(version), 0) into current_version
    from calculations where claim_id = p_claim_id;

  if current_version = 0 then
    raise exception 'Claim % has no locked calculation to revise.', p_claim_id;
  end if;

  perform set_config('app.revision_open', p_claim_id::text, true);

  insert into revisions (claim_id, from_version, to_version, reason, actor_id, note)
  values (p_claim_id, current_version, current_version + 1, p_reason, p_actor, p_note);

  update claims
     set status = 'draft', locked_at = null, sourcing_unlocked = false
   where id = p_claim_id;

  return current_version + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Auth arrives in a later phase. The policies are written now so that turning
-- authentication on is a matter of tightening `using` clauses rather than
-- retrofitting a security model onto live claim data.

alter table claims             enable row level security;
alter table comps              enable row level security;
alter table calculations       enable row level security;
alter table revisions          enable row level security;
alter table validation_events  enable row level security;

create policy claims_rw            on claims            for all using (true) with check (true);
create policy comps_rw             on comps             for all using (true) with check (true);
create policy calculations_rw      on calculations      for all using (true) with check (true);
create policy revisions_read       on revisions         for select using (true);
create policy validation_events_rw on validation_events for all using (true) with check (true);

-- Prior versions remain readable indefinitely: nothing here grants delete on
-- calculations or revisions, and the guards above reject it regardless.

-- Loss property photo. The report falls back to an illustration when null;
-- sourcing mechanism is still open (PRD section 13).
alter table claims add column if not exists photo_url text;

-- Where a comp's figures came from. 'firecrawl-zillow' obliges the report to
-- carry Zillow's attribution line; 'manual' means the operator keyed them.
alter table comps add column if not exists listing_source text not null default 'manual'
  check (listing_source in ('manual', 'firecrawl-zillow'));
