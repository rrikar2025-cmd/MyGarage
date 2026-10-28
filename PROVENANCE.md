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
