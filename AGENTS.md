Пишіть код як senior developer: суворі типи, невеликі компоненти, спільні примітиви та явна обробка помилок.
Дотримуйтеся FSD: app → pages → features → entities → shared; імпортуйте slices лише через index.ts.
Root app/ — лише маршрути Expo Router. Бізнес-логіка живе у src/.
Перед UI змінами читайте DESIGN.md та UX-CONTRACT.md. Усі тексти — через shared/i18n, всі кольори — через shared/theme.
Не зберігайте service-role ключ у застосунку. Не змінюйте старий DriveSpecX-RN.
Запускайте npm run check та npm run export:web. Нативний OBD потребує development build і фізичного BLE адаптера.
