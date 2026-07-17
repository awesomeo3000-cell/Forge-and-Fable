# Dreamwright 1.0 release runbook

Use this runbook only after every item in `RELEASE-1.0-CHECKLIST.md` is checked.

## Before deployment

1. Confirm CI passes `npm run release:check` and `npm run test:e2e` on the release commit.
2. Set the Render `BACKUP_EXPORT_TOKEN` secret to a unique value of at least 32 characters.
3. Set GitHub `DREAMWRIGHT_BACKUP_URL` to the deployed service URL and `DREAMWRIGHT_BACKUP_TOKEN` to the same token.
4. Run the backup workflow manually; download its artifact and confirm the restore-drill step passed.
5. Record the named deployment owner and rollback owner in the release notes.

## Release

1. Change `package.json` and `package-lock.json` from `0.1.0` to `1.0.0`.
2. Move the release-candidate notes in `CHANGELOG.md` from Unreleased to a dated `1.0.0` section.
3. Build and run both release commands again from a clean checkout.
4. Deploy the exact tested commit and verify `/api/health`, `/robots.txt`, `/sitemap.xml`, registration, login, and one authenticated character load.
5. Create the `v1.0.0` tag only after production verification succeeds.

## Rollback

1. The named rollback owner redeploys the previously known-good commit.
2. Do not roll the database backward automatically. If data recovery is required, stop writes and restore only from a verified backup under an incident plan.
3. Verify health, authentication, and character loading after rollback.
4. Record the failed release commit, user impact, backup used (if any), and follow-up owner.
