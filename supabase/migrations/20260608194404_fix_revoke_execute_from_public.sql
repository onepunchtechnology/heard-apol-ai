-- REVOKE from specific roles in 009/010 had no effect because PostgreSQL grants
-- EXECUTE to PUBLIC by default for all functions. Must revoke from PUBLIC first.

revoke execute on function public.claim_review(uuid) from public;
revoke execute on function public.match_brand_voice_replies(uuid, extensions.vector, text, int) from public;
