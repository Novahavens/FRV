-- Pin search_path on every function so a caller cannot redirect table or
-- function names by altering their session search_path (Supabase lint 0011).
alter function reject_writes_to_locked_claim()  set search_path = public, pg_temp;
alter function reject_writes_to_locked_parent() set search_path = public, pg_temp;
alter function open_revision(uuid, revision_reason, text, text) set search_path = public, pg_temp;
