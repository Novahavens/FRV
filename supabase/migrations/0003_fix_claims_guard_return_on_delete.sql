-- The claims lock guard returned NEW, which is NULL in a DELETE trigger, so
-- Postgres silently skipped every DELETE on claims — including drafts. Return
-- the row that applies to the operation, as the comps/calculations guard does.
create or replace function reject_writes_to_locked_claim()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'locked' and current_setting('app.revision_open', true) is distinct from old.id::text then
    raise exception using
      errcode = 'check_violation',
      message = 'This FRV is locked.',
      hint    = 'Request a revision with a documented reason. A revision creates a new version and leaves this one readable.';
  end if;
  return coalesce(new, old);
end;
$$;
