# Mazda 3 Import Tracker — Approved Project Plan

## Goal

Build a personal, mobile-friendly browser app to track multiple car imports into Ireland. The home page lists cars and important payments/dates; each car opens to a separate tracker and vehicle-editing page. No login or cloud backend is needed. The user's product brief is the approved source of truth for the prefilled Mazda 3; figures and regulatory assumptions must remain editable and clearly marked as unverified where applicable.

## MVP

- Prefill vehicle details for the 2016 Mazda 3 1.5L petrol automatic, Singapore plate SLG7315S, VIN JM6BM42A8G0338712, engine P520359077, and the remaining specifications in the brief.
- Costs: editable JPY/EUR exchange rate; line items with category, estimate, actual, status, date, notes, and receipt link; editable duty (10%/0%) and VAT toggles; manual VRT inputs and calculator; total landed cost; a cost timeline for invoice, customs, VRT, and fees with due dates, charged amounts, paid status, and outstanding-spend summaries.
- Documents: checklist with Have/Need/Waiting, notes, and optional links/files where supported.
- Timeline: stages, due dates, and reminders, including the outstanding ¥24,500 payment due 27 November 2026 and arrival/registration milestones.
- Browser-local persistence, JSON export/import, and CSV export for costs.
- Support multiple independent car records, add/remove cars, and migrate the original single-car browser data into the fleet.
- Responsive interface, light/dark mode, clear status colors, and a prominent next-action card.
- Visual dashboard with a cost-composition graphic and a cumulative spend-by-stage timeline; keep detailed editing panels collapsed until requested.

## Phase 2 (out of MVP)

Sale planner, comparable listings, mods log, attachments, and printable customs/NCTS summary.

## Data and calculation requirements

- Seed the invoice with FOB ¥406,000, freight ¥315,000, other ¥24,500, insurance ¥0, paid ¥721,000, unpaid ¥24,500.
- Default working exchange rate: ¥175.05 per €1, explicitly labeled unverified. Note that Revenue applies its monthly customs rate for the arrival month.
- CIF = (FOB + freight + insurance + other) / exchange rate.
- Duty = CIF × selected duty rate. Import VAT defaults to 23% on CIF plus duty and can be toggled off.
- VRT is entered manually; helper estimate is OMSP × CO₂ band percentage + NOx levy, with a €600 petrol NOx cap and a warning when emissions evidence is missing.
- Preserve the brief's VRT placeholder range (€1,500–€2,850) and estimated fee range (~€300); keep all estimates editable and distinguish estimates from confirmed values.

## Technical direction

Use the simplest maintainable client-side architecture suitable for the existing workspace. Persist structured app data in browser storage, validate imported JSON before replacing saved data, and provide downloadable exports. Do not add authentication, external services, or backend infrastructure.

## Acceptance criteria

- App starts and renders the prefilled vehicle, costs, document checklist, and timeline on a mobile-friendly single page.
- Cost calculations update when rates, invoice values, duty/VAT options, fees, or VRT inputs change.
- Data remains after refresh; JSON export/import and costs CSV export work.
- Light/dark mode can be switched, with readable status and warning states.
- Build and relevant tests pass.
