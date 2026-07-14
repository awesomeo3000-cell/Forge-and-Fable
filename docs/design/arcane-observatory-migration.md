# Arcane Observatory migration ledger

Required by the implementation plan ("Keep a migration ledger"). One entry
per migrated screen or component. Update in the same change that migrates
the surface — an unrecorded migration is not done.

Entry template:

```
## <screen or component>
- Old component/route:
- New component / token dependency:
- Behavior preserved:
- Known visual differences:
- Test coverage:
- Remaining legacy styles:
- Rollback commit:
```

---

## Phase 0 (2026-07-13)

No surfaces migrated. Branch `feature/arcane-observatory-redesign`; baseline
and audit in CHANGES-AO-0.md.
