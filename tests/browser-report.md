# Перевірка інтерфейсу — 2026-10-28

Середовище: production Expo Web build, локальний preview, реальний браузер Codex. Перевірки виконано через UI, не лише читання коду. Тестові записи створено лише в локальному сховищі preview; вони не є реальними даними користувача й не включені у вихідний код.

## Пройдені сценарії

- Початковий порожній гараж → додати Volkswagen Golf 2018, 85000 км → повернення до списку.
- Валідація порожньої форми; значення залишаються доступними для виправлення.
- Заправка 35,5 л / 2100,50 ₴ / 85300 км → відображення в щоденнику; пробіг авто оновлено.
- Сервіс «Заміна мастила та фільтра» / 3200 ₴ / наступний сервіс 95300 км → окрема категорія витрат.
- Редагування сервісу до 3300 ₴ → загальна сума 5400,50 ₴ без дублювання запису.
- Вихід із зміненої форми → app-owned підтвердження → скасування виходу → введене значення збережено, фокус повертається.
- Українська → English → українська: заголовки, кнопки, таби, повідомлення й формат чисел змінюються.
- Світла → темна тема; переваги й записи відновлено після повторного завантаження застосунку.
- Keyboard radio navigation: стрілка вправо зі світлої теми вибирає темну. Нативні HTML radio на web мають фактичний checked state.
- Діагностика у браузері явно повідомляє про потребу нативної збірки; кнопка читання без підключення недоступна. Жоден успішний скан не симулюється.
- Перегляд на ширині 390px і 320px. На 320px швидкі дії складаються вертикально; для табів додано короткі локалізовані підписи.

## Автоматизована перевірка

- npm run check: typecheck, 10 тестів і FSD import boundaries.
- SQL-міграція реально виконується у PGlite: власник A бачить свої авто/паливо, B не бачить і не може змінити їх; заборонено створити запис на чуже авто або підмінити owner; пробіг оновлюється; видалення авто каскадно видаляє паливо. Це локальний тест, не підтвердження налаштування реального Supabase.
- Expo dependency compatibility; Expo Doctor 18/18; Android/iOS prebuild; production Web/iOS/Android Hermes exports.
- DESIGN.md official lint: 0 errors. Попередження про невикористані у frontmatter компонентах токени не є перевіркою runtime-контрасту.

## Межі перевірки

У початковому етапі Supabase ще не був підключений. Стан після підключення й нових етапів описано нижче. Повний in-app auth/CRUD цикл із реальною поштою ще не перевірено. Немає фізичного BLE адаптера в цій сесії: не перевірено з’єднання на телефоні, permission dialogs, реальні PID/DTC відповіді або нативну release compilation/signing. Hermes export не є APK/IPA.

Фінальне видалення тестових записів через браузер не виконувалося: перевірено серверний механізм видалення ізольованим SQL-тестом. Не заявляємо повне ручне CRUD покриття. Додати перед релізом device accessibility / VoiceOver / TalkBack, реальні account recovery/deletion, offline/cloud failure recovery та конфлікти одночасних змін.

Веб-орієнтований сторонній premium static audit помилково трактує React Native <Button> як HTML <button> і шукає onClick замість onPress. Ці результати збережено в work/premium-web-audit.json як обмеження інструмента. У спільного Button тип onPress обов’язковий; TypeScript перевіряє кожне використання. Цей звіт не називає оригінальний сторонній аудит успішним.

## Етап 0.2.0 — наступна перевірка

У живому preview перевірено: перехід у звіти, поточний/попередній місяць, порожній період і недоступний CSV без записів, останні 12 місяців, обчислення сум і ціни літра; редагування старої заправки без втрати суми, додавання другої повної заправки з типом бензин; розрахунок 35л / 500км = 7л/100км. Зміна сервісної дати на майбутню відносно виконаної роботи, але минулу відносно сьогодні, показує прострочення навіть за наявності 9500км до порогу.

CSV-кнопка запускає браузерний експорт без помилки в інтерфейсі; вміст і безпечне екранування CSV перевірено предметним тестом. Нативне меню поширення на телефоні ще не перевірено. Файл не перевірявся через папку Downloads, оскільки in-app browser зберігає завантаження окремо.

20 автоматизованих тестів пройшли, включно з високосним роком, 601 фінансовим рядком, проміжними заправками, зміною типу пального, відкатом одометра, невідомими старими метаданими, кількома сервісними термінами та додатковою SQL-міграцією. Живий Supabase вже підключено: перевірено anonymous denial і транзакційні RLS-тести двох власників з повним ROLLBACK. Див. supabase/DEPLOYMENT.md. Повний in-app auth flow ще не перевірено.

Виявлено й усунено окремий packaging-регрес: Metro може повторно використати модуль зі старими порожніми EXPO_PUBLIC значеннями після створення .env. Чиста збірка підхопила ключі; postexport:web перевіряє конфігурацію у фактичному bundle, не виводячи значень.

## Етап 0.3.0 — акаунт

Веб production build: порожній вхід показує коректну помилку, не вимагає 8 символів для вже наявного пароля. Є перехід до відновлення; порожня пошта показує inline validation, листів не надсилали. Некоректний callback із test-only error query показує загальне повідомлення, адресу очищено до /auth/callback. Test-only code показує явну кнопку підтвердження; обмін не запускався. Reload після очищення показує крок нового запиту. Пряме відкриття /auth/password без recovery state не показує поля пароля. /account-delete без сесії не показує форму видалення.

28 автоматизованих тестів: попередні 20 + callback/path/parameter validation, правила нового пароля й безпечні помилки, orchestrator повторного пароля/видалення, SQL guards/cascades, два тести з реальною встановленою Supabase SDK та in-memory HTTP double. PGlite не замінює live SQL тест: окремий account-deletion-smoke.sql також завершився PASS у вибраному Supabase з повним rollback.

TypeScript, FSD boundaries, Web export і Web/iOS/Android Hermes export пройшли; export guard підтвердив поточні public env-параметри без друку значень. Підписану нативну збірку в цьому етапі не створювали. Нові Native PKCE-примітиви через expo-crypto потребують runtime перевірки на пристрої. Не перевірено введення користувачем нового пароля, фактичний email-link exchange з пошти та фінальне видалення реального акаунту через UI.

Додатково перевірено англійську у світлій темі на 320px: signup показує вимогу до пароля, reset screen читається без обрізання кнопки. Українська темна форма відновлення перевірена на 390px. Публічний Auth settings endpoint відповів 200: email enabled, signup enabled, email autoconfirm false.

## Етап 0.4.0 — перенесення діагностики

Production preview: перехід з огляду на окрему live-панель і далі в конфігурацію; вибір додаткових параметрів до восьми блокує решту, видалення повертає доступність. Вибір/порядок/одиниці зберігаються після reload. Кнопки руху мають назви з конкретним показником. Radio одиниць працює зі стрілками клавіатури; mph/°F/psi змінюються на km/h/°C/kPa без зміни записів щоденника. На 320px картки значень стають одноколонковими. Режими запитів і VIN-toggle працюють; читання й очищення недоступні без native-підключення, фальшивих успішних результатів немає.

34 TypeScript/domain/SQL тести, typecheck, FSD і форматування пройшли. Додані pure-read orchestration тести: лише запитані групи, дублікати, optional failure, повна невдача, disconnect, відсутня телеметрія; одиниці, розриви графіка та ліміт 30 циклів. Kotlin: 9 JUnit тестів (з попереднім CAN decoder regression), 9 VIN fixtures. Swift: ті самі 9 VIN fixtures, 8 response checks, iOS Simulator typecheck OBDManager. Шаблони VIN включають flat, ELM indexed, ISO-TP, J1850 з нульовим filler, incomplete/out-of-order і ambiguous ECU streams.

На живому Supabase міграція 004 застосована. scan-context-smoke.sql завершився PASS: default старого запису, відхилення не-object context, запис статусів та ізоляція двох власників; усі тимчасові дані відкочено. Production Web, Android та iOS Hermes export, web public-env guard і prebuild пройшли. Це не підписані APK/IPA і не перевірка фізичної BLE-сесії.

DESIGN.md lint: 0 помилок, 8 попереджень про токени, які не прив’язані до frontmatter-компонентів; runtime mapping збережений. Premium strict audit повертає 58 знайомих React-Native false positives affordance.actionless-button: він шукає HTML onClick у компонентах Button з required onPress. Артефакт work/premium-web-audit-v04.json; цей сторонній аудит не називаємо успішним. Власний TypeScript перевіряє наявність onPress, фактичні навігаційні дії перевірено в preview.

За прямою вказівкою користувача ручний device QA виконується після завершення перенесення. Поточні чесні межі: не перевірено реальний scan/save/retry на ECU, VIN зі справжнього авто, Mode 04 на фізичному ECU, графіки справжньої BLE-телеметрії та системні дозволи. Їхні parser/orchestration гілки перевірено автоматично; physical success не заявляється. Legacy/failure states без фізичного адаптера збережені явно.

Фінальна збірка: англійська світла конфігурація на 320px перевірена після reload; заголовок переноситься між словами, radio використовують спільний sans-serif шрифт. Прямий /scan/not-loaded показує порожній стан із дією Diagnostics. Налаштування повернуто до метричних одиниць і початкових чотирьох показників після перевірки.

## Етап 0.5.0 — встановлені деталі й план доробок

2026-10-28, локальний web export, телефонний перегляд 390px / українська / темна тема та 320px / English / світла тема. Новий код збережено в окремих FSD pages, полях і картках; спільний Choice має адаптивний grid-варіант. Перевірено переходи з огляду й гаража, порожні стани, бюджет, створення деталі та плану, категорії/пріоритет/статус, майбутню планову дату, редагування орієнтовної ціни, фільтри, підтвердження встановлення й захист незбереженої форми. Під час неправильної дати виконання фокус переходить до відповідного поля. javascript: URL відхилено без відкриття. Введені поля після помилки та скасування виходу збереглися. У діалозі видалення перевірено назву/суму/обсяг і скасовано; фінального видалення записів через UI не виконували.

Локальні фікстури мають префікс «Тест:», залишені тільки в сховищі цього preview-браузера; у коді немає seed-даних. Бюджет 10 000; перша встановлена деталь 3 200,50; план гальм 5 000 → встановлення за фактичною ціною 5 500,75. Лише зміна статусу на «Виконано» не збільшила фактичних витрат. Після встановлення: фактична сума 8 701,25, подвійного додавання планових 5 000 немає. Другий план 2 000 → редагування 2 100,25: прогноз 10 801,50, перевищення 801,50, прогрес 1/2 = 50%. Звіт пального/сервісу лишився 7 500,50. Перезавантаження зберегло дані та налаштування. Заголовки й контролери переносяться на вузькому екрані; візуального горизонтального переповнення на перевірених сторінках не виявлено. DOM-перевірка верхнього preview-документа не дає доступу до геометрії iframe, тому це не твердження про повний descendant-overflow аудит.

41 npm test пройшов, TypeScript/FSD пройшли, форматування пройшло. Додані тести старого гостьового формату, грошей/дат/URL, точних сум на 1200 рядках, відбору авто, повтору/конфлікту/відсутнього встановлення, атомарності міграції та account cascade. Production JS/Hermes export для web/iOS/Android пройшов; обидва публічні параметри Supabase перевірено у bundle. Expo prebuild оновив семантичну версію до 0.5.0, номери бінарних збірок лишилися 1. Серверні Deno-функції відокремлено від мобільного tsconfig; їхні deployment/runtime перевірки не входять у цю заяву про mobile typecheck.

Міграція 005 й фінальне календарне уточнення застосовані на MyGgarage. projects-smoke.sql повторно пройшов на живій БД: owner isolation, foreign parent/RPC block, stale/invalid rollback, idempotent install, retained expense on plan deletion, removed expense not resurrected, car cascade, denied anon. Усі серверні тестові ідентичності й рядки відкочено; реальні акаунти/записи не видалено. Міграції після 005 цим звітом не вважаються застосованими.

DESIGN.md lint: 0 errors, 8 orphan-token warnings (runtime RN tokens). Strict premium HTML audit: 72 findings одного правила affordance.actionless-button. У кожного вказаного RN Button перевірено onPress/onClick; веб-евристика не розпізнає RN onPress. Strict audit формально не пройшов; він не заміняє виконані браузерні перевірки. Native адаптер і модулі Swift/Kotlin цього етапу не змінювалися; старі parser-тести повторно не запускалися. Ручний цикл на фізичних телефонах лишається відкладеним за побажанням користувача. Фото/чеки через приватний Storage, загальні конфлікти та offline outbox ще попереду.

## Етап 0.6.0 — приватні фото та серверні нагадування

Автоматизовано: 48 тестів, TypeScript/FSD, форматування, production Web/iOS/Android JS/Hermes exports та prebuild. Нові перевірки охоплюють typed targets/JPEG/size, реальний SDK upload ArrayBuffer і signed links, SQL owner/parent spoofing, quotas/finalize/no overwrite, account media fencing/cascade/queue, additive 006→009 upgrade, session-bound token/timezone, latest-service/date/odometer/local hour, stage/revision idempotence, job-key/path/message/ticket disposition. Deno source + однофайлові dashboard артефакти перевірено окремо. Native parser цього етапу не змінювався.

Live MyGgarage: 007–010 застосовано (006 уже була); приватний bucket, Edge delete-account/garage-jobs, Cron кожні 15 хвилин. Protected HTTP dryRun 200: privateBucket:true, enabledDevices:0. Обидві функції відхилили неавторизований виклик 401. photos-push-smoke.sql пройшов повною транзакцією: два власники, foreign access/write/parent/actor denial, missing upload rejected, fresh-password fence, account metadata cascade/cleanup queue, other owner retained, anon/job-key denial, single push claim. ROLLBACK прибрав усі фікстури; файли й реальні сповіщення не використовувалися. Знімки підтвердження в матеріалах чату.

Перевірка UI в production web: 390 px / українська / темна — фото з огляду, повернення, фото чеків конкретного сервісу зі щоденника, кнопки картки гаража та розгорнутої встановленої деталі. Гостьова галерея пояснює хмарне зберігання й не показує upload. Веб-налаштування пояснюють потребу встановленого застосунку; не імітують працюючий перемикач. На фінальному оновленому export пройдено 320 px / English / light: гостьова галерея й push settings, видимі тексти без обрізання; збережено знімки. Повернуто українську/темну тему та 390 px. Перевірено також фото планової деталі з розгорнутої картки. Чужі/відсутні цілі захищено schema/repository; signed-in UI вручну не перевірявся.

DESIGN lint: 0 errors / 8 orphan-token warnings. Strict сторонній HTML audit формально має 77 actionless-button findings, усі одного правила. У кожному фрагменті є RN onPress; обов’язковий тип Button + tsc перевіряють обробники. Strict audit не заявлено успішним; ці результати не доводять відсутність інших UX проблем.

Не перевірено: справжній signed-in gallery upload/preview/retry/delete, камера/permissions на телефоні, APNs/FCM видима доставка, push tap у закритому застосунку, реальний акаунт із фото та парольним видаленням. SQL fixtures не замінюють Storage HTTP behavior. Android FCM конфігурація ще відсутня; нова development-збірка потрібна для native dependencies. APK/IPA немає, build numbers 1; ручний device QA відкладений користувачем до завершення перенесення. Email OTP не ввімкнено.

## Доповнення 0.6.0 — фото під час створення авто

51 автоматизований тест, TypeScript і FSD пройшли. Нові доменні перевірки не допускають foreign/receipt/unfinished photos на картку, перевіряють вибір нового фото, повернення до попереднього після видалення та обмеження локальних file references конкретним авто. Виправлено retry створення зі стабільним UUID: повтор після збою фото оновлює той самий запис і зберігає серверні canonical поля. Native основні фото пишуться в documents з новим UUID і commit pointer перед очищенням попереднього; web Blob замінюється атомарно в IndexedDB. Реальна native файлова поведінка ще не тестувалася.

Production web, 390 px / українська / темна: додати авто → вибрати власний assets/icon.png як технічне тестове зображення → preview → порожній submit дає валідацію й зберігає фото → Back дає app-owned guard → скасувати вихід → заповнити «Тест фото / Локальний перегляд», 2020, 12000 км → Save → одна нова картка зі зображенням → вибрати авто → Overview показує це ж фото. Повний reload → Garage знову показує збережене фото з IndexedDB → Edit відкриває попереднє фото → вибір іншого локального зображення → Cancel photo selection повертає попередній cover → Back без діалогу, бо змін немає. Фото гостя також видно на його сторінці «Фото», звідти є Edit. Нічого не завантажено в Supabase під час цього браузерного тесту.

English/light 320 px: існуюче фото та нові підписи у формі редагування, збережені значення, перенос довгої назви; два натискання Tab переводять фокус на Change photo. Знімки збережено у матеріалах чату. Повернуто українську/темну тему та 390 px. Тестова картка лишається локальним прикладом у preview, не seed-кодом і не записом хмарної БД. Реальні фото користувача не оброблялися й реальні записи через UI не видалялися.

Web/iOS/Android JS/Hermes export і форматування перевірено. DESIGN lint 0 errors / 8 warnings. Strict HTML-аудит має 77 actionless-button findings одного правила: кожен фрагмент містить RN onPress, усі використання обов’язково типізовані. Цей сторонній strict-аудит не заявлено успішним.

Хмарний cover використовує наявні приватні attachment/RLS/TTL контракти; нових SQL/серверних налаштувань немає. Повний signed-in upload→card цикл, camera permissions, native documents retention/replacement/cleanup і device accessibility — на узгодженому фінальному тесті. Звичайний browser reload пройшов; очищення сайту/даних застосунку видалить локальні фото.

## Вилучення доробок за рішенням користувача — 2026-10-28

З активного застосунку прибрано маршрути projects/project-entry/project-budget, сторінки, budget/install/CRUD дії, посилання й локалізацію цього розділу. Від’єднано cloud queries modifications/build_items і старі публічні domain exports. Фото автомобілів та чеків залишилися; mod/build attachment targets більше не відкривають галерею. Старі джерела й 6 domain tests архівовано під work/retired-upgrades поза runtime/typecheck/активними тестами. SQL-тести історичної схеми залишено для контролю owner RLS та lifecycle, оскільки серверні дані не видаляються.

47 актуальних тестів пройшли: попередні 51 мінус 6 тестів вилученої функції плюс 2 перевірки сумісності гостьових snapshot. Нові перевірки доводять, що старі записи mods/builds/бюджет та фінансові поля зберігаються після round-trip й звичайного оновлення. TypeScript/FSD/production web та iOS/Android JS/Hermes export пройшли. DESIGN lint: 0 errors / 8 warnings. Strict HTML audit формально має 64 actionless-button findings; усі фрагменти містять RN onPress, обмеження інструмента попереднє. Формально успішним його не називаємо.

Production browser 390 px / українська / темна: огляд без доробок, чинні витрати 7500,50 ₴ / 4200,50 паливо / 3300 сервіс та наступний сервіс збережено. Гараж має ті самі два локальні автомобілі, фото тестового авто з IndexedDB, Edit/Delete/Photos без Upgrade buttons. Старий прямий /projects/<id> показує локалізований not-found із поверненням на огляд; /attachments/mod/<old-id> показує Record not found. У новому web bundle немає Car upgrades / Доробки авто / install_build_item / project-entry / project-budget. Preview оновлено, тимчасову вкладку перевірки закрито.

Реальних записів, таблиць або Storage-файлів не видаляли. Немає destructive migration, повторного db push чи публікації. Фізичний device QA лишається на узгодженому етапі.

## ELM327 connection and misleading scan names — code-only verification

2026-10-28: user reported a real iPhone connection failure; the same adapter worked in YMOBD. The old screenshot contains only generic UI error text, so the exact physical failure is not proven. Source defects: one 25s timeout covered transport and a potentially longer ELM/ECU sequence; only Nordic/HM10 were explicit and generic selection could pick a configuration write characteristic; cancelled/retried iOS sessions could receive stale callbacks, and repeated prompt packets could advance the next command. Updated iOS policies/lifecycle, explicit FFF0 profile, independent phase deadlines and error codes; Android FFF0/overall timing updated. No actual adapter or ECU command was exercised by the agent.

A second screenshot showed MacBook and unnamed devices in the room. Native discovery scans every BLE advertisement; the UI falsely labelled Unknown as BLE adapter. Default name-based likely-OBD filtering, explicit full-list fallback and honest unnamed-device labels now cover this. Advertising names are not compatibility proof.

51 TypeScript/domain/SQL/SDK tests passed, including connection error classification, privacy-safe diagnostic output, probable-vs-unrelated discovery names and unnamed-device labels. 13 new standalone Swift regression checks passed for FFF2 vs configuration, UUID expansion, ambiguous/unrelated services, Nordic/HM10, bounded phase budget and split/extra-prompt handling. OBDManager + policy/parser sources typechecked against the real iOS Simulator SDK; Android ObdManager/parser sources compiled against SDK36. CocoaPods updated and registered ConnectionPolicy.swift in the Obd target. Production web export and config checks passed. Native simulator compilation checks do not prove radio connectivity.

Per explicit user preference: no browser/visual QA, screenshot automation or physical connection test. User retest: room without an adapter should have no probable OBD candidates; Show all BLE may show computers/unnamed devices. After installing a fresh iOS development build, close YMOBD, power the adapter in the parked vehicle with ignition on, select OBDII, and report the new failure code if it still fails. An IPA/APK was not built or installed by this code-verification stage.
