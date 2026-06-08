alter table reviews drop constraint if exists reviews_status_check;

alter table reviews add constraint reviews_status_check check (
  status in (
    'pending', 'processing', 'auto_posted', 'needs_review',
    'reply_pending_manual', 'failed', 'approved', 'rejected', 'imported'
  )
);
