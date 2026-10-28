# Observable interaction contract

## Sources

Current user brief (2026-10-28): separate Expo project, FSD, Ukrainian/English, light/dark, Supabase, all DriveSpecX capabilities over successive migration stages, vehicle details, service log, refuelling and expense totals.
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
- Vehicle deletion explicitly names car and permanently cascades scans, fuel and service. Single journal deletion names date and cost and recalculates totals. No bulk financial-history deletion exists.
- A journal odometer greater than the current reading advances current mileage, atomically in cloud. Historical entries may use lower mileage. Deleting or correcting an entry does not automatically reduce current vehicle mileage; correct it via vehicle edit.
- Service reminders use the latest entry per category; other-category tasks are keyed by normalized title. Date or odometer can trigger due status independently. Due soon means <=30 days or <=500km. Overdue sorts first. Reminders are in-app; push scheduling is not implemented yet.
- Overview totals use the current calendar month/year. Detailed reports allow past months/years, the last 30 inclusive calendar days, or the last 12 months through today. UAH only. Historical dates use ISO date-only and do not shift timezones. Amounts sum as integer kopecks. Future dates and invalid dates rejected.
- Guest data remains local and separate from signed-in cloud data. No silent migration, upload or account mixing. Cloud load failure never switches to guest storage. Failed writes remain pending on screen. Sign-out is device-local, and disconnects the adapter.
- Real adapter scanning requires a native development build. BLE ELM327 is supported; no Bluetooth Classic or Wi-Fi claim. Search is bounded, can stop, and stops on background/unmount. One serialized native queue handles connect, reads and telemetry; polling pauses in background. Permission denial and connection failure get explicit recovery copy.
- Only codes actually returned by stored/pending/permanent OBD engine requests are shown. No vehicle health or safety score is inferred. A code-free response is not a full-vehicle inspection.
- Scan results remain visible when saving fails, with a retry and unsaved navigation protection. Selected vehicle is captured at scan start.
- Fonts scale with the OS. Interactive targets >=48px. Native safe areas respected. Browser keyboard focus, confirmation focus containment and restore are owned by shared primitives.
- No new account, server migration or store publication is done without the user's chosen service/project configuration. Existing DriveSpecX Firebase and app-store identities remain untouched.

## Known stage limits

The selected Supabase project is configured and all four migrations were applied; live transactional RLS checks passed. Full in-app Auth/email and two real signed-in sessions remain unverified. Apple/Google sign-in, photos, AI proxy, modifications, builds and performance migrate in following stages listed in ROADMAP.md. Concurrent cloud edits currently use last successful write; conflict handling is a release gate. Vehicle list fetch is bounded at 100, cloud scan history fetch at 100 (older rows remain in the database; guest history is retained in full), visible per-car scan history at 20. Financial history fetches every page for complete totals; UI renders 20 records per batch.

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
