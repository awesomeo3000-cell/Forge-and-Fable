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
- [x] Live shell/onboarding artwork is WebP-optimized; a 1 MiB per-asset budget is enforced and hosted delivery is tested.
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

## Remaining blockers before tagging 1.0.0

- [ ] Verify the production Resend sender/domain and complete real delivered-email registration, resend, verification, forgot-password, and reset flows.
- [ ] Configure scheduled off-volume backups on the chosen host, alert on failure, and record a successful restore drill.
- [ ] Run the complete manual character journey for Standard, Quickbuilder, and Premade creation; levels 1–5; subclass, feat, spell, rest, effects, skin, print, import, export, and save/reload.
- [ ] Run a hosted two-browser campaign/concurrency session with separate DM and player accounts and confirm no lost character updates.
- [ ] Complete keyboard-only, focus-trap, screen-reader labeling, contrast, reduced-motion, and zoom checks across every modal and major workspace.
- [ ] Complete a production mobile pass for the builder, full character sheet, dice drawer, campaign workspace, and DM table—not only authentication.
- [ ] Choose the final public product/repository name and make README, package name, deployment service, metadata, email copy, and domain language consistent.
- [ ] Add final privacy policy, terms, support/contact route, and the licensed-content attribution/notice supplied by the rights holder.
- [ ] Measure hosted performance, extend asset budgeting to generated portraits and JavaScript bundles, and set an agreed mobile LCP budget.
- [ ] Update `package.json` to `1.0.0`, write the release changelog, create the release tag, and record rollback ownership only after every blocker above is checked.

## Post-1.0 maintainability queue

- Split `ForgeAndFableApp.tsx`, `HeroSheet.tsx`, the DM table stores, and append-ordered global CSS into tested feature boundaries.
- Add production error tracking, structured request logging, backup/disk alerts, and a release SHA in admin diagnostics.
- Remove or implement remaining forward-compatible settings that have no production behavior.
- Extend Playwright from release smoke coverage to the full builder, progression, campaign, PDF import, and concurrency matrices.
