-- Add shopify_domain to stores
-- store_domain = public-facing domain (e.g. ohayopop.com, awesomeshop.com)
-- shopify_domain = internal myshopify domain required by Shopify Admin API and Judge.me (e.g. abc123-0.myshopify.com)
-- Backfill: existing rows had the myshopify domain stored in store_domain, so copy it across.

alter table stores add column if not exists shopify_domain text;

update stores set shopify_domain = store_domain where shopify_domain is null;
