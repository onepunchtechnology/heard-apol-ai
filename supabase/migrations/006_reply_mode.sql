alter table stores
  add column reply_mode text not null default 'manual_approval'
    check (reply_mode in ('auto_post', 'manual_approval'));
