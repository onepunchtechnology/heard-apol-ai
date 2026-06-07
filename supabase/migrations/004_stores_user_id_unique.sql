-- Each user owns exactly one store. Prevents duplicate store rows from
-- check-then-insert races (double-submit during setup) that would break
-- all downstream maybeSingle() calls.
alter table stores
  add constraint stores_user_id_key unique (user_id);
