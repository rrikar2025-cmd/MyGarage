-- Preserve old scans; new context describes only what was actually requested/read.
alter table public.diagnostic_scans add column context jsonb not null default '{}'::jsonb
  check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 16384);
-- Existing owner RLS, grants and parent-owner FK continue to govern this column.
