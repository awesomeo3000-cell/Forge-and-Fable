# Dreamwright 1.0 release checklist

Status date: 2026-07-17

This is the authoritative release-readiness document. Historical roadmaps and proposal files describe how features were built; they do not override this checklist.

## Completed release hardening

- [x] Canonical production URL is required for verification and password-reset links; request Host headers are not trusted.
- [x] Rate-limited, non-enumerating verification resend flow with token rotation.
- [x] Render generates `JWT_SECRET`; production verification and internal-review route defaults are explicit.
- [x] Enforced CSP and cross-origin security headers.
- [x] Public health response exposes only liveness; detailed storage/schema health is admin-only.
- [x] Theme observatory routes return 404 in production unless explicitly enabled.
- [x] Portrait listing/deletion, per-user quota, global media quota, and revocable cache duration.
- [x] Account JSON export and password-confirmed self-service account deletion.
- [x] Production backup command rejects accidental same-volume disaster-recovery claims and verifies every new backup.
- [x] Production and development dependency audits report zero known vulnerabilities.
- [x] Desktop and mobile hosted smoke tests cover security headers, health, registration, login, export, and deletion.
- [x] Route, global-error, and not-found fallbacks provide recoverable production error UX.
- [x] Live shell/onboarding artwork is WebP-optimized; recursive per-asset and total public-asset budgets are enforced.
- [x] Action capability unresolved queue reconciled to zero; resolution evidence is in `action-capability-audit/RESOLUTIONS-2026-07-17.md`.

## Automated gates

Run:

```bash
npm run release:check
npm run test:e2e
```

CI must require:

- [x] Rules research structural validation.
- [x] Release artwork size and legacy-format validation.
- [x] Unit and integration tests.
- [x] ESLint with zero warnings.
- [x] TypeScript validation.
- [x] Production build.
- [x] Production and development dependency audit.
- [x] Chromium desktop and mobile release smoke tests.
- [x] Serious/critical automated accessibility scans for public entry, legal, authenticated home, and account-data dialog surfaces.
- [x] Mobile entry-surface LCP, transfer-size, public-asset, and JavaScript bundle budgets.

## Verified during the 2026-07-17 release pass

- [x] Production Resend delivery: registration, resend with token rotation, verification, forgot-password, reset, and login with the reset password.
- [x] Dreamwright.gg is the final public brand; README, package name, deployment service, metadata, email copy, and domain language are consistent.
- [x] Privacy, terms, legal/licensing, support/contact, robots, and sitemap routes are present.
- [x] Unreferenced source portraits and legacy start artwork were removed; all public image/audio assets are checked recursively with a 25 MiB total and 1 MiB per-file budget.
- [x] Production JavaScript bundles are checked at 3.5 MiB raw/1 MiB gzip total and 1.5 MiB raw/350 KiB gzip per chunk.
- [x] Hosted mobile entry measured 736 ms LCP and 985,883 transferred bytes against the 4-second/3.5-MiB release budget.
- [x] A local production-data backup and restore drill passed from `D:\dreamwright-backups`; the old C-drive backup directory was removed.
- [x] Hosted Premade journey: create, save/reload, levels 1–5, Champion subclass, Tough feat, HP/rest/hit-die behavior, Bless effect, skin persistence, and Extra Attack.
- [x] Hosted Quickbuilder reached its complete 6/6 review state for a Sorcerer/Tiefling character.
- [x] Automated keyboard/Escape, focus containment, serious/critical axe, and reduced-motion checks pass on the covered release surfaces.

## Remaining blockers before tagging 1.0.0

- [ ] Deploy the backup export endpoint and configure matching Render `BACKUP_EXPORT_TOKEN` plus GitHub `DREAMWRIGHT_BACKUP_URL` and `DREAMWRIGHT_BACKUP_TOKEN` secrets. Confirm the scheduled workflow uploads an off-host artifact and alerts on failure.
- [ ] Finish the manual Standard and Quickbuilder save journeys, plus spell selection/casting, print, import, and export coverage.
- [ ] Run a hosted two-browser campaign/concurrency session with separate DM and player accounts and confirm no lost character updates.
- [ ] Complete human keyboard-only, screen-reader, contrast, and 200% zoom checks across every modal and major workspace; automated checks do not replace assistive-technology testing.
- [ ] Complete a physical production-mobile pass for the builder, full character sheet, dice drawer, campaign workspace, and DM table.
- [ ] Assign a named deployment/rollback owner, then update `package.json` to `1.0.0`, move the changelog entry out of Unreleased, and create the release tag only after every blocker above is checked.

## Post-1.0 maintainability queue

- Split `ForgeAndFableApp.tsx`, `HeroSheet.tsx`, the DM table stores, and append-ordered global CSS into tested feature boundaries.
- Add production error tracking, structured request logging, backup/disk alerts, and a release SHA in admin diagnostics.
- Remove or implement remaining forward-compatible settings that have no production behavior.
- Extend Playwright from release smoke coverage to the full builder, progression, campaign, PDF import, and concurrency matrices.
