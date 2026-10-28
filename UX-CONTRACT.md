# Observable interaction contract

## Sources

Current user brief (2026-10-28): separate Expo project, FSD, Ukrainian/English, light/dark, Supabase, DriveSpecX capabilities over successive migration stages, with upgrades/build planning explicitly removed by the latest user decision, vehicle details, service log, refuelling and expense totals.
Domain source: src/entities/garage/model/types.ts and supabase/migrations/202610280001_garage.sql. Original native contracts: modules/obd, copied from DriveSpecX-RN with parser fix preserved.
Permission model: authenticated owner only; RLS on every table and composite parent-owner foreign keys. No billing. No production legal copy is invented in this stage.

## Canonical UI Map

| Capability     | Canonical owner                          | Source of truth             | Allowed variants                    | Verification                                      |
| -------------- | ---------------------------------------- | --------------------------- | ----------------------------------- | ------------------------------------------------- |
| Form           | shared/ui/Field + page editor validation | domain validation           | vehicle / fuel / service / auth     | domain tests + browser flow                       |
| CRUD           | entities/garage store + repository       | schema + domain model       | guest / account                     | browser-report.md + SQL tests before cloud launch |
| Toast          | shared/ui/Notice                         | this contract               | info / error / success              | persistent inline live region                     |
| Select/Listbox | shared/ui/Choice                         | DESIGN.md                   | labelled radio choices; no dropdown | keyboard browser check                            |
| Date           | shared/ui/Field                          | domain date-only validation | typed YYYY-MM-DD; no native popup   | date unit tests                                   |
| Scrollbar      | app/global.css                           | DESIGN.md                   | light / dark / forced-colors        | browser                                           |

## Flows

- Add/edit vehicle → save validated record → garage list. Save fuel/service → journal. Cancel/back from dirty forms asks about discarding. Save failure retains all inputs. Duplicate submit disabled. All new record IDs are stable across retries.
- Vehicle deletion explicitly names car and permanently cascades scans, fuel, service, modifications and build items. Single journal deletion names date and cost and recalculates totals. No bulk financial-history deletion exists.
- A journal odometer greater than the current reading advances current mileage, atomically in cloud. Historical entries may use lower mileage. Deleting or correcting an entry does not automatically reduce current vehicle mileage; correct it via vehicle edit.
- Service reminders use the latest entry per category; other-category tasks are keyed by normalized title. Date or odometer can trigger due status independently. Due soon means <=30 days or <=500km. Overdue sorts first. The in-app schedule remains available to guests and signed-in users.
- Service reminder push is an explicit iOS/Android opt-in for signed-in cloud accounts. The device registers one Expo push token, locale, and IANA timezone; users can disable this device without affecting other devices. A server job sends a generic reminder once at the soon stage and once again if it becomes overdue, at 09:00 local device time. Pushes link to the service schedule and do not expose vehicle or service details on the lock screen. Guest accounts continue to use in-app reminders only.
- Overview totals use the current calendar month/year. Detailed reports allow past months/years, the last 30 inclusive calendar days, or the last 12 months through today. UAH only. Historical dates use ISO date-only and do not shift timezones. Amounts sum as integer kopecks. Future dates and invalid dates rejected.
- Guest data remains local and separate from signed-in cloud data. No silent migration, upload or account mixing. Cloud load failure never switches to guest storage. Failed writes remain pending on screen. Sign-out is device-local, and disconnects the adapter.
- Real adapter scanning requires a native development build. BLE ELM327 is supported; no Bluetooth Classic or Wi-Fi claim. Search is bounded, can stop, and stops on background/unmount. One serialized native queue handles connect, reads and telemetry; polling pauses in background. Permission denial and connection failure get explicit recovery copy.
- Only codes actually returned by stored/pending/permanent OBD engine requests are shown. No vehicle health or safety score is inferred. A code-free response is not a full-vehicle inspection.
- Scan results remain visible when saving fails, with a retry and unsaved navigation protection. Selected vehicle is captured at scan start.
- Fonts scale with the OS. Interactive targets >=48px. Native safe areas respected. Browser keyboard focus, confirmation focus containment and restore are owned by shared primitives.
- No new account, server migration or store publication is done without the user's chosen service/project configuration. Existing DriveSpecX Firebase and app-store identities remain untouched.

## Known stage limits

The selected Supabase project is configured and migrations 001–010 were applied; live transactional RLS checks passed. Full in-app Auth/email and two real signed-in sessions remain unverified. Apple/Google sign-in, AI proxy and performance migrate in following stages listed in ROADMAP.md. Concurrent cloud edits currently use last successful write; conflict handling is a release gate. Vehicle list fetch is bounded at 100, cloud scan history fetch at 100 (older rows remain in the database; guest history is retained in full), visible per-car scan history at 20. Financial history fetches every page for complete totals; UI renders 20 records per batch.

## Logbook 0.2.0 additions

- Fuel type may remain unknown for legacy records; full_tank defaults to false. Never infer a full tank from volume or cost. Consumption is weighted by distance across complete, same-fuel cycles; include intermediate partial fills, exclude the baseline fill. Unknown type or an odometer rollback resets the baseline. Reports include cycles by end date.
- Service next_date must be a valid date strictly after its completed service date. Future reminder dates are allowed. Editing a historical entry targets its owning vehicle, even when another vehicle is currently selected.
- All financial report buckets use all fetched records in range; month buckets include the year in labels across boundaries. Reports do not combine currencies. Summation uses kopecks; fuel volumes use milliliters internally.
- CSV export is explicit. Browser downloads a local Blob; native shares a cached CSV via the system sheet. No recipient, upload or send is chosen automatically. Only selected-car / selected-range rows are exported. User-authored strings are protected from spreadsheet formula interpretation.
- New canonical owners: shared/ui/Toggle for full-tank state, pages/reports/ui/PeriodSelector for report periods, shared/export for platform file handoff, features/export-journal for domain export. Existing Field and Choice own form behavior.
- During an in-flight form save, navigation cannot discard a potentially committing write. Button selection state is preserved for screen readers. Shared Field associates help/error text with its input.
- Supabase schema status, transaction verification and CLI history reconciliation are recorded in supabase/DEPLOYMENT.md. Environment export verification prevents a stale, unconfigured client bundle after adding .env.

## Account 0.3.0 additions

- Authentication owns email/password, resend, recovery request, callback exchange, new password and account removal. Screens compose small feature components. Email existence is not disclosed in reset/signup success copy; rate limits and generic failures are persistent inline messages. Sign-in accepts existing passwords shorter than the new-password rule; signup/new passwords require >=8 characters.
- Links accept only exact app callback paths and same-origin web callbacks, with one PKCE code and optional bounded flow id. Token fragments, duplicate/foreign parameters and open redirects are rejected; server error details never render. Browser query/hash is scrubbed before exchanging code. Explicit Verify link prevents an automatic exchange by this app; upstream email scanners can still consume the email provider's verify URL. A lost volatile callback/recovery state requires a new request.
- The PASSWORD_RECOVERY event binds the password form to that user in memory; it is not inferred from a query flag. Auth state listeners remain synchronous. Normal logout is device-local. Password reset success logs out this device; other-session behavior follows server policy.
- Account deletion requires the current verified account, successful password sign-in, typed localized confirmation and a final dialog naming the email. The RPC checks expected subject against auth.uid, live session ownership and recent password AMR. No target id grants authority. Requests cannot navigate away while committing. Successful deletion immediately clears garage memory and invalidates in-flight reads, then clears the local auth session. Guest storage is retained.
- Migration 003 and redirects were applied after explicit user approval. Live rollback verification passed; real email delivery, in-app password update/deletion with user-entered credentials, two real accounts and native deep linking remain release gates. No real account was deleted during development.

## Diagnostics and telemetry 0.4.0

- Scan scope is explicit: confirmed/stored only, or stored + pending + permanent. Optional failure stays unavailable; not-requested stays not-requested. At least one requested group must have a readable response for a result. No severity/occurrence count/health percentage is invented.
- The adapter's serialized operation owner handles scan, VIN, clear and foreground telemetry. A disconnect invalidates pending operations. An unsaved scan remains protected across disconnect/reconnect; clear is blocked until it is saved or explicitly discarded.
- Each new scan stores context: mode, per-group status, VIN availability/value, duration, adapter label and live-snapshot time. Column 004 defaults legacy scans to an empty object. Old empty lists do not establish a successful ECU response. A VIN mismatch skips autosave and requires explicit confirmation naming the selected car and both VINs.
- Native VIN decoding reassembles flat, ELM-indexed, ISO-TP and numbered legacy frames, including leading zero filler. Incomplete/out-of-order/ambiguous valid streams fail closed. DTC parsing preserves CAN count-byte handling, requires a positive response and rejects incomplete counted payloads. Multi-frame DTC completion beyond currently supported formats remains a device validation item; incomplete data is unavailable rather than clean.
- Mode 04 requires a parked/engine-off acknowledgement and final confirmation. The native layer reads fresh RPM and speed immediately before the command, requires every returned matching value to be zero, and requires a positive 44 response. Missing readings or ACK block success. Permanent-code cache is not erased. Saved scan history is immutable by this operation; a new scan is required after clearing.
- Live native caches reset per polling cycle; missing PIDs do not inherit an older cycle's reading. Samples are bounded to 30 and reset for a new connection. Charts are ordinal polling cycles, not uniform-time samples. No server persistence of continuous telemetry was added.
- Preferences select 1–8 of 20 mapped readings and their order. Metric/imperial conversion applies to speed, temperature and pressure in live/snapshot views. Logbook distance/fuel/currency stays km/litres/UAH. MAP remains absolute, oil temperature is not oil pressure. AFR estimates that assume a fixed gasoline ratio are not surfaced as universal measurements.
- Actual ECU freeze frame, readiness completeness, PID-support discovery, all-module scans and severity scoring are not implemented. Physical validation is deferred until the user's chosen final testing stage; parser/SDK/SQL/browser checks continue during development.

## Removed upgrades / build planning

Source: explicit user request on 2026-10-28. Remove entry points, routes, parts/build editors, upgrade budgets, installation actions, feature translations and cloud collection queries. Old direct routes use the canonical not-found page; retired mod/build attachment targets cannot open a gallery or trigger upload in the current app. Vehicle/fuel/service photos remain available.

No database purge or destructive migration is part of removal. Existing server tables, RLS, private objects and migration history remain intact. Guest snapshots round-trip opaque legacy mods/builds and vehicle budget fields so ordinary saves do not erase historical financial records. Explicit vehicle/account deletion retains the established all-linked-data lifecycle. Retired sources are archived under work/retired-upgrades, excluded from active routes/build/typecheck/tests; no runtime enable flag exists.

## Private attachments and push 0.6.0

- Photo target is a saved owner-bound vehicle, fuel or service entry. Caption and target context identify the record. Guests see cloud-only copy and sign-in; no silent guest upload. Camera is native only. Selecting a photo immediately uploads the prepared copy, with a stable id for retry; pending upload and caption drafts guard navigation. Failed prepared copies remain available for retry/discard; removal names the caption and requires Confirm.
- AttachmentGallery/AttachmentTile are canonical photo owners; AttachmentButton is shared by entry points. Never persist public links or signed URLs in data/preferences. View links expire in 60 seconds, refresh while focused, and clear on blur/session change. Mobile temporary prepared files are removed when finished/discarded/unmounted. System-selected originals are retained.
- Private Storage uses own metadata and typed parent FKs. JPEG only, 5 MiB output, 10 per target, 200 per owner. Original input <=20 MiB and <=12000 px per side; output longest side 1600 px, receipts 2400 px. Re-encoding excludes original EXIF. Client preparation is not a malware/content inspection service.
- Parent deletion queues physical files for Storage API removal. Queue worker runs every 15 minutes, expires incomplete reservations after an hour and retains deletion tombstones 7 days for late uploads. Deleted metadata immediately stops issuing new links; previously issued links can survive until expiry/removal. Account deletion fences uploads, removes own files through Storage API then removes account. Failure can leave photos partly removed and upload blocked; copy tells users to retry completion. Never promise atomic rollback of Storage plus Auth.
- Push toggle is native and opt-in only for signed-in users. Web explains installed-device requirement. Refresh of existing opt-in updates token/session/locale/timezone without prompting. Disabling affects this token; session deletion cascades registered devices. Lock-screen text excludes car, service and financial detail.
- Server claims once per entry/device/stage/deadline revision at 09:00 device-local time. Cron runs every 15 minutes. New deadline can notify again; date or mileage may trigger status. A claim precedes sending; an unknown send result is not retried automatically, so delivery can be missed. Expo ticket/receipt acceptance does not establish visible phone delivery; transport delivery guarantees are not claimed.
- Live private-bucket/config/auth/fixture checks passed. Actual photo upload, native permission dialogs and physical push delivery remain unverified. Android requires its own FCM setup before build. New development binary is required; browser UI is not evidence of device delivery. Keep email link confirmation; deferred OTP is inactive.

## Vehicle photo while adding or editing

Source: user request 2026-10-28 to select a vehicle photo during creation and replace the default card illustration. VehiclePhotoField/useVehiclePhotoDraft own staged camera/library selection and preparation; existing fields and navigation guard remain canonical. Save first persists the stable-UUID vehicle, then its selected photo. A failed photo write keeps the selection and explains that the car already exists; retry upserts the same vehicle instead of duplicating it. Until Save, cancel/back never persists a selected image. Cancel selection restores the previously saved cover.

Guest covers are a specific exception to cloud-only galleries: one main image per vehicle is stored in the app's document directory on native, or as an IndexedDB Blob on web. Shared/media owns this storage; photo bytes and temporary object URLs are never added to guest JSON. Replacing commits a new file pointer before deleting the prior native copy; IndexedDB replacement is transactional. Vehicle deletion/guest-load pruning cleans detached local covers. Signing in never uploads guest photos. A guest vehicle photo page can preview its saved cover and link to edit; additional photos/receipts still require the cloud account.

Cloud covers reuse owner-protected vehicle attachments and 60-second signed links, without a new public URL column or database migration. The latest ready vehicle attachment (created_at, then id) supplies the card cover; pending/other-kind/foreign photos do not. Garage loads covers in a bounded batch; focus/app-active refresh and cleanup prevent stale account links and leaked browser object URLs. Gallery additions/removals are reflected when returning to the cards. No photo/network error removes the car; the drawing is a safe fallback.

Manual phone camera, native file lifecycle and authenticated cloud integration remain part of the deferred device QA. Local browser create/photo/validation/navigation/reload coverage is recorded in tests/browser-report.md.

## BLE troubleshooting and discovery — 2026-10-28

The user now owns visual/device UI checks; agents run code and targeted tests without browser verification unless explicitly requested. Report the short manual retest steps.

Discovery is an unfiltered native BLE scan, not proof of an ELM327 device. ConnectionPanel initially lists only name-based likely OBD candidates. Other/unnamed devices remain available behind Show all BLE devices with an explicit explanation. Unnamed devices are labelled Unnamed device with a short distinguishing suffix; never call every scan result an adapter. Advertising names only guide discovery; the ELM/ECU handshake still determines readiness. Unknown adapter names must retain this explicit full-list fallback.

Connection failures distinguish transport, UART selection, notifications, AT/reset response and ECU negotiation, with a bounded technical code that excludes raw peripheral identifiers or vehicle data. An older binary's single connection timeout cannot identify the failing phase and is not labelled as a proven BLE timeout. Connection cancellation settles the active promise; stale callbacks and timeouts cannot complete a new iOS attempt. Each command keeps a unique timeout token; an extra reset prompt cannot complete the next unsent command.

Known UART profiles select explicit data characteristics before a generic fallback; FFF0 writes use FFF2 and notifications FFF1, not an arbitrary writable configuration channel. Ambiguous iOS fallback services are rejected. Transport and initialization have separate bounded time budgets; Connected still requires a positive PID 0100 response. Native changes require a rebuilt iOS development app; reloading JS alone updates the discovery list/error copy, not native connection behavior. No Mode 04 or ECU write tests are performed for this fix.
