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

## Phase 3 (2026-07-14) — global shell

- Old component/route: shell chrome in ForgeAndFableApp (`.builder-shell`,
  `.builder-topbar.ledger-topbar`, `.vault-rail.ledger-rail`,
  `.studio-surface`, `.ff-toast`) — legacy CSS untouched, overridden by the
  scoped Phase 3 block in arcane-observatory.css.
- New component / token dependency: semantic surface/text/border/state
  tokens + old-gold accent; attribute flip on `<body>`.
- Behavior preserved: all TSX logic; auth/creation/sheet/campaign flows.
- Known visual differences: photo backdrop removed from logged-in shell
  (splash/auth keep it pending Gate 3); roster rail no longer skin-tinted
  (skins = sheet + toast seal only); toasts dark with skin-accent rule.
- Test coverage: build/test/lint; recaptured screenshot set (passes 1/2/5).
- Remaining legacy styles: all interiors (Phase 4A–4C), splash/auth.
- Rollback commit: remove body attribute or revert AO-3.
