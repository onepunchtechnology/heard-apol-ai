-- Fix mutable search_path on claim_review and lock down public execute access.
-- The agent calls claim_review with the service role key (bypasses RLS/grants),
-- so anon and authenticated never need to call it directly.

create or replace function claim_review(p_review_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  update public.reviews
  set status = 'processing', updated_at = now()
  where id = p_review_id and status = 'pending'
  returning id into claimed_id;
  return claimed_id;
end;
$$;

revoke execute on function public.claim_review(uuid) from anon, authenticated;
