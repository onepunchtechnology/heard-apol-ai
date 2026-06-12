-- Track how many times we've claimed a review for processing.
-- Enables retry/circuit-breaker: recycle to pending on quota errors,
-- circuit-break to needs_review after 3 total claim attempts.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS process_attempts integer NOT NULL DEFAULT 0;

-- Increment atomically on claim so the Python agent reads the authoritative attempt count.
CREATE OR REPLACE FUNCTION public.claim_review(p_review_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed_id uuid;
BEGIN
  UPDATE public.reviews
  SET status = 'processing',
      updated_at = now(),
      process_attempts = process_attempts + 1
  WHERE id = p_review_id AND status = 'pending'
  RETURNING id INTO claimed_id;
  RETURN claimed_id;
END;
$$;
