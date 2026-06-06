-- Revoke public execute on claim_review — only the service role (Cloud Run agent) should call it.
-- Authenticated and anon users must not be able to interfere with review processing via PostgREST.
revoke execute on function claim_review(uuid) from anon, authenticated;
