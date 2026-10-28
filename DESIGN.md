---
version: alpha
colors:
  primary: '#176157'
  background: '#F1F4F3'
  surface: '#FFFFFF'
  foreground: '#172D32'
  muted: '#52666C'
  darkBackground: '#101D22'
  darkSurface: '#1A2D33'
  darkForeground: '#EDF5F3'
  darkPrimary: '#8EDCC5'
  hero: '#173E46'
  danger: '#B43036'
typography:
  body:
    fontFamily: 'system-ui, sans-serif'
    fontSize: '16px'
    lineHeight: '24px'
  data:
    fontFamily: 'Menlo, monospace'
    fontSize: '29px'
    lineHeight: '38px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
rounded:
  sm: '10px'
  md: '18px'
  lg: '26px'
components:
  Button:
    height: '50px'
  Field:
    height: '50px'
---

# My Garage / Мій гараж

## Overview

A personal vehicle logbook for Ukrainian car owners: costs and service history first, real OBD-II diagnosis alongside it. Product register. Visual reference: a well-kept service booklet and the restrained instrument markings of a touring car. Signature: the owner's chosen vehicle photo on the dark petrol card, with the technical side-profile drawing as the fallback when no photo is available. No stock car photography, fake gauges, racing graphics or synthetic health score.

## Colors

Charts use primary green for fuel and chartSecondary (#547692 light / #91B2DB dark) for service, with explicit text labels and amounts; no color-only meaning. Runtime source of truth: src/shared/theme/index.ts (`palettes`, `space`, `radius`, `fonts`). The values above mirror the runtime; change both together. Light mode uses mist grey, white paper and deep green actions. Dark mode uses blue-grey surfaces and mint actions. Success, warning and danger retain semantic labels and icons. app/global.css mirrors theme tokens only for browser focus and scrollbar chrome.

## Typography

Use platform system fonts for body and headings, preserving Ukrainian Cyrillic and Dynamic Type. Menlo on iOS and monospace elsewhere distinguishes measured data. 30/37 title, 20/27 section, 16/24 body, 13/19 caption. Allow labels to wrap. Never clip financial values or vehicle names.

## Layout

One vertical scroll owner per route, safe-area insets, 20px horizontal screen padding, 760px maximum reading width. Phone first. Below 360px or with enlarged system text, tab labels use short localized variants while accessible names retain both short and full labels. Five tabs: overview, garage, journal, diagnostics, settings. Journal renders 20 rows at a time. Financial aggregates use all stored rows, never the visible page. Base rhythm: 4/8/16/24/32. Forms stay in document flow and preserve drafts on failed writes.

## Elevation & Depth

Surface fills define hierarchy. No decorative gradients or stacks of shadows. Native confirmation modal alone receives a dimmed scrim.

## Shapes

10px controls, 18px content cards, 26px selected vehicle card. The larger radius belongs to the vehicle signature rather than every surface.

## Components

Canonical primitives are exported by src/shared/ui/index.ts. Button owns size, loading and semantic intent; Field owns labels, password visibility and errors; Choice owns language/theme/category radio options; Confirm owns serious confirmations; Notice owns persistent inline feedback. Feather icons. No automatic ambient animation; reduced motion removes browser transitions. Missing telemetry is an em dash, never a zero. Locale follows src/shared/model/preferences.ts and src/shared/i18n. Light, dark and system preferences persist.

## Do's and Don'ts

Use ordinary Ukrainian, precise verbs and honest limits. Show where guest data lives. Keep real Bluetooth status distinct from cloud connectivity. Do not imply a successful scan in a browser, promise a vehicle is safe, hide unsaved results behind a toast, or present a fabricated OBD reading.

## Logbook reports

Reports and service dates are stack screens reached from overview/journal, preserving five primary tabs. Report period controls wrap at phone widths and clearly disable future navigation. Stacked horizontal cost bars are actual values with zero-value tracks, not decorative gauges. Longer ranges group by calendar month with year labels; short ranges by seven-day buckets. Consumption has a distinct card and explanatory assumptions. Service status uses text plus icon, and supports both date and odometer thresholds. Form controls use existing tokens and share disabled/busy semantics.

## Account flows

Email recovery and callbacks reuse Field, Notice and Button. The callback has one primary explicit action. New-password requirements appear before submit; password managers, paste and show/hide controls remain available. A separate account-removal screen names the account, explains financial-history scope, asks for the existing password and typed confirmation, and uses the canonical Confirm modal for the irreversible final action. No account deletion entry is shown to guests. Recovery copy states the same-device requirement and expired-link next step.

## Diagnostics and telemetry 0.4.0

The live dashboard is a separate stack route reached from overview or diagnostics. Configuration has its own route so controls do not bury live readings. It reuses canonical Choice, Toggle and Button; selected parameters have accessible up/down alternatives to dragging. MetricGrid owns live and saved-value presentation, including localized unit selection. At <360px values stack in one column. MetricTrend uses real, bounded connection samples; missing values break the path. No decorative/fabricated gauges or test telemetry are shown in product UI.

CodeGroup owns status, empty, unavailable and older-record behavior and expands a small explicit glossary. Scan details use a historical-record notice and distinguish live snapshots from actual ECU freeze frame. VIN mismatch requires an explicit assignment confirmation; it does not silently rewrite vehicle identity. Code clearing uses the canonical danger Confirm with real consequences and engine-off/parked conditions.

## Removed capability

At the user's request on 2026-10-28, vehicle upgrades, installed-part management, build planning and upgrade budgets are removed from the product. No entry points, editors or active routes remain. Garage and Overview keep vehicle photos, fuel, service, costs and diagnostics. Existing legacy data is retained without exposing a dormant feature switch.

## Private photos and reminders 0.6.0

Saved car and receipt entry points use AttachmentButton and a stack route, keeping five tabs. Gallery context names car and saved record/date. AttachmentGallery owns selection/upload/retry/removal, AttachmentTile owns image/caption/loading/error/incomplete states. Inline full-size viewing uses contain, no crop that could hide receipt values. Existing Button/Field/Confirm/Notice and dirty/busy guards stay canonical; no second modal or permission system. Guests get a clear cloud-only explanation. Signed images are temporary view state, not cached public assets.

Push controls live in Settings, with native opt-in and explicit loading/error/retry. Web shows a readable installed-app notice instead of an enabled-looking control. Lock-screen copy is generic and bilingual; opening a reminder goes to service dates. Preserve dark/light contrast and wrapping at 320px. A server acceptance state is never presented as proof of physical delivery.

## Vehicle cover in the editor

VehiclePhotoField reuses the existing camera/library preparation and canonical Button/Notice. Selection is staged with an inline 16:9 preview; only Save vehicle persists it. VehicleCard renders that photo in the same reserved 16:9 frame on Garage and Overview. The technical drawing remains the fallback. Names and mileage stay outside the image for readable contrast. The latest completed cloud vehicle photo is its cover; receipt/part/pending/foreign images never qualify. Guest vehicle covers are stored locally without automatic account upload. Cancel selection affects only the new draft.

## BLE result and failure labels

ConnectionPanel reuses existing Button, Notice and caption text. Separate likely OBD names from the optional full BLE scan; unknown devices are never presented as confirmed adapters. Keep a cancellation action available during connection. Failure copy tells users the failed stage and next action; a short failure code supports device retesting without exposing raw logs. The user requested code-only checks and will verify visuals; no browser QA is required for this change.
