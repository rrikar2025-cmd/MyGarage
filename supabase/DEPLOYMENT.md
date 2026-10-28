# Supabase deployment state

Project selected by the user via .env: MyGgarage, ref `diwegzgjyccvqbuhzrlf`.

2026-10-28: applied 202610280001_garage.sql , 202610280002_logbook_details.sql and 202610280003_account_deletion.sql through the authenticated Supabase SQL Editor. All completed successfully. No old DriveSpecX backend was touched. Client publishable settings stay in ignored .env; no service-role key was requested or stored.

Verification: an unauthenticated REST request to each of the four tables returns 401 / 42501. A live database transaction tested two temporary owners, own-car visibility, foreign-car invisibility, blocked foreign updates and owner spoofing, composite parent ownership, automatic odometer advancement and the fuel details columns. It completed with PASS and rolled back all temporary auth users/records. This checks real database authorization; it does not replace in-app signup/sign-in/email testing.

## Migration history

These SQL files were applied manually; do not blindly run the initial schema again. Before adopting CLI db push, link to THIS project, inspect migration history, and mark the verified versions applied:

```bash
supabase link --project-ref diwegzgjyccvqbuhzrlf
supabase migration list
supabase migration repair --status applied 202610280001
supabase migration repair --status applied 202610280002
supabase migration repair --status applied 202610280003
supabase migration repair --status applied 202610280004
supabase migration list
```

This CLI step has not been run in this session; the installed CLI did not launch in the execution environment, while the user-authenticated dashboard was available. No database password or management token was extracted. The commands above update history only once linked. Check the actual remote state before applying them. Reference: [Supabase migration tracking and repair](https://supabase.com/docs/guides/deployment/database-migrations).

Current remaining launch gates: in-app Auth confirmation/recovery/deletion, two real account sessions, conflict handling, and physical iOS/Android tests. The native development build must be rebuilt for the new sharing/file-system dependencies.

## Auth configuration — 0.3.0

After explicit user approval, Site URL was set to `http://localhost:8082`; allowed redirects are `mygarage://auth/callback`, `http://localhost:8081/auth/callback`, `http://localhost:8082/auth/callback`, plus each exact callback followed by `?sb_flow_id=*` for SDK flow-slot compatibility. No wildcard domain or arbitrary app path was enabled. Production URLs are not configured. Email confirmation remains enabled; no password/security policy was weakened. Existing default ConfirmationURL email templates were not changed.

The final RPC is `delete_own_account(p_confirmation text, p_expected_user uuid)`, SECURITY DEFINER with empty search_path, revoked from PUBLIC/anon, granted only to authenticated. Expected user id is a concurrency guard compared with auth.uid, never an independent deletion target. The function requires a live session belonging to the subject and a password AMR timestamp within five minutes. It deletes only auth.uid and relies on existing cascade foreign keys. No Storage objects exist in this app yet; future Storage lifecycle must be included before photos ship.

`supabase/tests/account-deletion-smoke.sql` passed against this live project: wrong confirmation, expected-subject mismatch, foreign session and stale password are denied; the subject's user/session/vehicle/fuel/service/scan rows are removed; another user's account/vehicle survive; anon cannot execute. The entire fixture transaction was rolled back. No real user was removed and no email/password was created or changed by the agent.

Local SDK contract tests exercise S256/verifier exchange, PASSWORD_RECOVERY, session persistence and device-local logout with an HTTP double. They do not prove real delivery or native linking. Before release: user-driven signup/email/reset/deletion, two real sessions, native SecureStore/WebCrypto/link return, production exact redirect origin, custom SMTP and sender setup. Follow [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) and [user lifecycle](https://supabase.com/docs/guides/auth/managing-user-data).

## Scan context — 0.4.0

202610280004_scan_context.sql applied through SQL Editor on 2026-10-28. Adds only an object-valued bounded JSONB context column to diagnostic_scans, default {}; owner RLS, grants and parent FK continue unchanged. The live scan-context-smoke.sql test passed for old defaults, malformed-context rejection, correct metadata and two-owner isolation; all temporary fixture records were rolled back. No real car scan or ECU clear was performed. CLI migration history still needs reconciliation for versions 001–004 before db push.
