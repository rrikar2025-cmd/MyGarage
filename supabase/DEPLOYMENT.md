# Supabase deployment state — 0.6.0

User-selected project: **MyGgarage**, ref `diwegzgjyccvqbuhzrlf`. Last verified 2026-10-28 through the authenticated Supabase dashboard. Original DriveSpecX backend was not changed. Client publishable settings remain in ignored `.env`; no service-role key or Vault plaintext was extracted or placed in app source, documentation or exports.

## Applied schema

| Migration                 | Current state / verification                                                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 garage                | Applied: owner RLS, vehicle/scan/fuel/service tables, composite parent ownership and odometer advancement. Live fixture transaction passed, rolled back.                                                                                                                                                    |
| 002 logbook details       | Applied: fuel type/full tank, service date and logbook fields. Existing records retained.                                                                                                                                                                                                                   |
| 003 account deletion      | Applied: own subject, expected-user concurrency guard, live session and password AMR within 5 minutes. Live negative/cascade fixture checks passed, rolled back. Extended by 007 below.                                                                                                                     |
| 004 scan context          | Applied: bounded object-valued context with legacy default. Live malformed/default/owner fixture checks passed, rolled back.                                                                                                                                                                                |
| 005 projects              | Applied: modifications/build_items/budget, owner RLS, atomic idempotent install_build_item and version guard. Live fixture tests for foreign access, retries, cascade and retained actual costs passed, rolled back. Date checks tolerate UTC/local day boundary; client still rejects future actual dates. |
| 006 push reminders        | Found already applied during 0.6.0 preflight, zero registered devices. Original migration retained; do not reapply.                                                                                                                                                                                         |
| 007 private attachments   | Applied: private JPEG bucket, typed parent/owner FKs, quotas, reservation/finalize/upload fencing, Storage policies, deletion queue and account lifecycle.                                                                                                                                                  |
| 008 garage jobs           | Applied: random 32-byte job key generated within Postgres; SHA-256 hash in service-only garage_job_settings, plaintext only in Supabase Vault secret mygarage_job_key.                                                                                                                                      |
| 009 push delivery upgrade | Applied additively over 006, retaining rows. iOS/Android, live-session FK, locale/timezone/token validation, deadline revision + one-time claims, ticket/receipt status. Legacy session-less device rows cannot send until re-registered.                                                                   |
| 010 media guard           | Applied: explicit actor check before owner-state lock; fair queue index by last_checked_at.                                                                                                                                                                                                                 |

007–009 were applied atomically; 010 and schedule configuration subsequently succeeded. `supabase/tests/photos-push-smoke.sql` passed live with two isolated temporary owners: own metadata, denied foreign/spoofed parents, missing-upload finalization denial, account upload fencing, cleanup/cascades, anon denial, protected job settings and once-only claims. All fixtures rolled back. No actual files, real accounts or pushes were sent/deleted. Local PGlite covers more branch cases; Storage service bytes are not simulated as live verification.

## Deployed functions and scheduler

- `delete-account`: verifies the current bearer token with Supabase Auth; expected user/typed confirmation plus recent password/live-session checks remain in SQL. Fences new uploads, lists/removes only the subject's flat UUID JPEG folder through Storage API, then calls the own-account RPC. Cannot select a foreign deletion target. Partial file removal can precede final account removal; a failed request must be retried to completion. No real account was deleted during this work.
- `garage-jobs`: SHA-256 checks independent `x-mygarage-job-key` against service-only settings. No public-client key can authorize scheduled work. Prunes incomplete reservations older than 1 hour, removes queued objects through Storage API (200 per run), retains tombstones 7 days to catch late completion, and handles push claims/tickets/receipts. Independent cleanup/send/receipt operations do not block each other, and partial failure returns 500.
- Both have gateway **Verify JWT with legacy secret OFF**, matching `supabase/config.toml`; full authorization is enforced inside the functions as described above. Unauthorized direct POSTs to both returned **401**. Do not turn off these in-function checks.
- `pg_cron` and `pg_net` enabled. Active Cron job **mygarage-garage-jobs** runs `*/15 * * * *`. SQL source: `supabase/schedules/service-reminder-pushes.sql`. URL is pinned to this chosen project. The scheduler obtains the key from Vault inside the database; no service-role key is sent as a Cron request header.
- Protected dryRun HTTP returned **200**, `ok:true`, `privateBucket:true`, `enabledDevices:0`; active schedule verified. A dryRun sends/removes nothing. This proves deployed routing/auth/config access, not physical notification delivery or image-byte cleanup.
- Old source `send-service-reminders` is retired and not deployed. Do not follow older hourly/service-role-in-Vault instructions.

Mobile tokens are kept in native private storage and tied to live auth sessions. Opt-in is explicit per device. Server checks latest service per category/title, due <=30 days / <=500 km, once soon and once overdue per deadline revision, during 09:00 device-local hour. Locale/timezone/token refresh occurs for existing opt-in without asking permission again. Claims are reserved before sending; unknown send results are not retried automatically, avoiding repeated application send attempts but potentially missing a notification. Ticket or receipt acceptance is not proof that a notification appeared on a phone. Transport-level exactly-once delivery is not promised. Expo rejects invalid tokens; DeviceNotRegistered disables a device.

To redeploy with a configured authenticated CLI, review project/ref first and deploy the source functions (do not reapply SQL):

```bash
supabase functions deploy delete-account --project-ref diwegzgjyccvqbuhzrlf --no-verify-jwt
supabase functions deploy garage-jobs --project-ref diwegzgjyccvqbuhzrlf --no-verify-jwt
```

Dashboard editor requires a single file: `node scripts/prepare-edge-deploy.mjs` prepares source-only artifacts in work/edge-deploy. Both original sources and these artifacts passed Deno typecheck. The CLI could launch via official npm, but had no management session; deployment used the already signed-in dashboard. Do not extract browser credentials to bypass CLI login.

## Private media contract

Private `mygarage-private` bucket, JPEG only, 5 MiB per stored image; up to 10 per saved target and 200 per owner. Stable UUID reservation → non-upsert ArrayBuffer upload → verified Storage metadata finalize; retries reuse the id. No direct metadata update or object overwrite. Client prepares JPEG without source EXIF, longest side 1600 px for cars/parts or 2400 px for receipts. Original selection <=20 MiB / <=12000 px per side. Original filenames are not persisted.

Owner Storage policies require matching own metadata. Read uses signed links for 60 seconds, held only in view memory; focused galleries refresh every 45 seconds. Metadata cascades queue physical deletion rather than SQL-delete storage.objects. Storage API removes bytes. Parent removal stops new view links immediately; an issued link can live until expiry or object removal. Guests do not upload or automatically migrate.

## Auth configuration retained

Site URL `http://localhost:8082`; allowed redirects `mygarage://auth/callback`, `http://localhost:8081/auth/callback`, `http://localhost:8082/auth/callback`, and each exact callback followed by `?sb_flow_id=*` for SDK compatibility. No wildcard domain or arbitrary app path. Production redirects remain unset. Email confirmation stays enabled with standard ConfirmationURL templates. User explicitly deferred OTP; no SMTP/Pro/email template change was made.

RPC `delete_own_account(text,uuid)` remains revoked from PUBLIC/anon and granted to authenticated only. Expected user is compared to auth.uid, never an independent authority. 007 now refuses deletion while own Storage objects remain; native code calls protected Edge orchestration after password sign-in. Local SDK tests verify PKCE/recovery/session behavior with an HTTP double. Actual email, native link return, user-entered password reset/deletion and two real sessions remain manual release checks.

## Migration history reconciliation — still required

SQL was applied manually. Do **not** blindly run `db push` or initial schema again. Before adopting CLI migrations: link to this exact project, inspect remote schema and migration list, then mark only verified matching versions 202610280001 through 202610280010 applied. Verify again before future pushes. History repair itself has not been run. For a different new project, change refs/URLs, deploy both functions and initialize its own Vault/Cron configuration; never reuse a secret from this project. Reference: [Supabase migration tracking](https://supabase.com/docs/guides/deployment/database-migrations).

## Remaining device/release gates

- Fresh development binary for notifications, image picker/manipulator and prior native OBD/sharing modules. Prebuild and JS/Hermes export passed; APK/IPA signing/build not performed in this stage, build numbers remain 1.
- Android package `com.mygarage.mobile`: separate Firebase/FCM project/config and EAS FCM credentials still needed. No google-services.json is present; DriveSpecX credentials were not copied. The user explicitly chose to configure Firebase/FCM before the Android build; no setup is attempted at this stage.
- iOS bundle `com.mygarage.mobile.garage`, EAS project `197a6135-fd34-4ba6-b39a-c30e889118cf` is configured. Earlier work recorded Apple App ID Push capability enabled; APNs provisioning and real delivery are not verified by this stage.
- On physical iOS/Android: camera/library permission refusal, real image upload/view/retry/remove, foreground/background notification delivery/deep link, per-device disable/logout, invalid-token handling, account deletion with real stored files and user-entered credentials. Manual testing deferred until migration is complete as requested.
- Production exact Auth redirects, privacy/support/store declarations, conflict handling and remaining roadmap items before publication. No store publication or paid subscription has occurred.

## Vehicle cover in the editor — source-only addition

No server/schema change: creating/editing with a cloud vehicle photo uses the existing owner-protected reservation/upload/finalize path. The latest ready vehicle attachment is resolved in a bounded batch and viewed through existing 60-second signed URLs. Other attachment kinds and uploading states are excluded. Guest main photos use app-private local files / IndexedDB, without cloud upload. Physical native file lifecycle and a real authenticated upload/card loop remain deferred; local browser persistence and domain cover selection were verified. Migration history remains 001–010, unchanged.

## Upgrades removed from the app

2026-10-28: user removed the product capability. Client routes, CRUD, budgets and queries for modifications/build_items were retired. No destructive SQL, row deletion, Storage purge or migration-history change was applied. Existing owner RLS, historical records, private attachments and car/account cascade cleanup remain. Guest snapshots keep opaque legacy rows and vehicle budget fields during ordinary writes. This removal does not introduce new deployment credentials or functions.
