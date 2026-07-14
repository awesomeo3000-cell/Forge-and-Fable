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

## Phase 1 (2026-07-14) — token foundation

- Old component/route: none (additive).
- New component / token dependency: `src/app/arcane-observatory.css`
  (`[data-theme="arcane-observatory"]` scope), `/theme-observatory` showcase.
- Behavior preserved: all — no product surface reads the new tokens yet.
- Known visual differences: none anywhere in the product.
- Test coverage: build/test/lint gate (CHANGES-AO-1).
- Remaining legacy styles: all of globals.css, untouched by design.
- Rollback commit: the AO-1 commit is self-contained.

## Phase 2 (2026-07-14) — shared primitives

- Old component/route: none (additive).
- New component / token dependency: `.ao-*` primitive classes in
  `src/app/arcane-observatory.css`; showcase gallery on `/theme-observatory`.
- Behavior preserved: all — no product surface uses `.ao-*` yet.
- Known visual differences: none anywhere in the product.
- Test coverage: build/test/lint gate (CHANGES-AO-2); a11y sweep deferred
  to first real migration (Gate 2 checklist).
- Remaining legacy styles: all of globals.css, untouched by design.
- Rollback commit: the AO-2 commit is self-contained.
