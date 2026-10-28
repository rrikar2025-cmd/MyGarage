# Походження повторно використаного коду

Джерело: /Users/a/Desktop/DriveSpecX-RN, наявний локальний проєкт користувача, прочитаний 2026-10-28. Оригінал не редагувався.

- modules/obd: Swift/Kotlin джерела, DtcDecoder, тести, Gradle/podspec, Expo registration та MIT LICENSE скопійовано без build outputs. Збережено CAN count-byte виправлення. JS entrypoint адаптовано до optional native module та правильних Android permission branches; Android startScan тепер відхиляє Promise при винятку.
- Мапінг PID ключів адаптовано до FSD entities/obd. Відсутні дані не підміняються нульовими.
- plugins/with-versioned-android-release.js і scripts/build-android-release.mjs адаптовано до назви MyGarage та окремого app-version.json.
- Firebase services досліджено як контракти поведінки; нові репозиторії переписано для Supabase.
- Старі app identifiers, Apple Team, EAS project, Firebase config, ключі, підписи, користувацькі записи та assets старого бренду не переносилися.

Власні UI-компоненти, теми, тексти, щоденник, витрати та нова SQL-схема створено для My Garage. Поточний код НЕ заявляє повний функціональний паритет старого застосунку; ROADMAP.md містить решту.

## 0.4.0 diagnostic references

- Migrated behavior inspected in the original app/vehicle-diagnostics, dashboard parameter flows and shared/utils/units. Original DriveSpecX checkout remains unchanged. Existing CAN DTC count-byte fix is preserved and regression-tested. New code does not copy fabricated severity, occurrence counts or live-as-freeze-frame semantics.
- [ELM327 datasheet — Multiline Responses](https://www.elmelectronics.com/wp-content/uploads/2016/07/ELM327DSH.pdf): Mode 09 PID 02, indexed CAN and numbered legacy VIN responses, leading filler. Tests use synthetic/public sample VIN data, no user's VIN.
- [Ford 2024–2025 OBD operation summary](https://www.fordservicecontent.com/Ford_Content/catalog/motorcraft/OBD_Operation_Summary_to_Gasoline_MY_2024_2025.pdf): small generic glossary for P0171/P0172, P0300–P0304, P0420/P0430; Ukrainian summaries are translations/paraphrases, not a manufacturer-specific repair procedure.
- [Bureau of Automotive Repair OBD reference](https://bar.ca.gov/obd-test-reference): permanent codes are cleared by the ECU after its own verification, not by treating a Mode 04 request as proof that they disappeared. No local inspection-law claim is made for Ukraine.

## 0.5.0 Mods / Builds

Read-only behavioral references: original src/features/mods/{types,service}.ts and src/features/builds/{types,service}.ts plus the vehicle editors. The original nine categories, installed detail fields, planned prices, priority and completion concept were adapted to bilingual FSD code. Supabase schema, validators, exact-cost aggregates and atomic/idempotent plan installation are new implementations; Firebase services, credentials, source user records and image URLs were not copied. Images remain pending private Storage lifecycle work. No edits were made in DriveSpecX-RN.

## 0.6.0 Photos / push

New attachment schema, owner/parent checks, private Storage repository, camera/gallery UI and cleanup lifecycle are My Garage implementations. Existing DriveSpecX photo URLs, Firebase config, storage records and user files were not copied. SDK54-compatible expo-image-picker/image-manipulator APIs were checked against installed source/types; native JPEG recompression excludes source EXIF.

The pre-existing 006 push schema and iOS opt-in source were retained as the baseline; additive 009 introduces Android/session binding/revision claims. Source server jobs now use their own hashed Vault key and receipt tracking. Official references: [Storage deletion API](https://supabase.com/docs/guides/storage/management/delete-objects), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [Expo push tickets/receipts](https://docs.expo.dev/push-notifications/sending-notifications/). These references describe platform contracts, not proof of device behavior in this project. No old DriveSpecX backend was changed.

## Vehicle card cover — addition to 0.6.0

VehiclePhotoField, staged draft hook, batched cover resolution and local guest-photo adapters are new My Garage code. They reuse the existing image preparation/private attachment repository. No original DriveSpecX photos, Firebase configuration or user images were imported. Browser validation used this project's own assets/icon.png as an explicitly named local test image; it is not a replacement stock photograph shipped as a default.

## Upgrades retired — 2026-10-28

The user explicitly removed upgrades/build planning from the product scope. Its app routes, pages, editor/link components, domain management code and feature-only tests were moved to work/retired-upgrades, outside the runtime and configured TypeScript/test inputs. Active API exports and network reads were removed. Existing migration 005 and server/guest historical rows remain for lossless retention and original deletion lifecycle; this is not a destructive rollback. Original DriveSpecX remains unchanged.
