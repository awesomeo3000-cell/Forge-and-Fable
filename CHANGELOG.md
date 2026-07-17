# Changelog

All notable Dreamwright changes will be recorded here.

## Unreleased

### Added

- Dreamwright.gg production branding, canonical metadata, robots, and sitemap support.
- Privacy, terms, legal/licensing, and support routes.
- Authenticated database export endpoint, scheduled off-host backup workflow, and automated restore drill.
- Automated accessibility, reduced-motion, mobile performance, public-asset, and JavaScript bundle release gates.

### Changed

- Transactional email now consistently uses the Dreamwright identity and canonical production URL.
- Release documentation now separates automated evidence from required human and deployment sign-off.
- Local backups are stored on `D:\dreamwright-backups` to keep them off the constrained C drive.

### Removed

- Unreferenced generated portrait masters and obsolete start-screen source artwork from the production repository.

This entry remains Unreleased until all blockers in `docs/RELEASE-1.0-CHECKLIST.md` are complete.
