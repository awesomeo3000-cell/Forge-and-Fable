# PDF Character Import Proposal

## Goal

Allow a player to upload a character sheet PDF from D&D Beyond or another source, review what Forge & Fable detected, then create a Forge & Fable character draft from it.

This should be an assisted import, not a silent one-click overwrite. PDF exports vary too much, and some sheets are flattened visual documents rather than fillable forms.

## Sample PDF Finding

Test file inspected:

```text
E:\downloads\AWESOMEOH_75969686.pdf
```

Observed:

- 7-page D&D Beyond PDF.
- `pypdf.get_fields()` found 0 form fields.
- Standard text extraction returned mostly template labels.
- Rendered page clearly contains character values such as name, class, ability scores, HP, AC, attacks, proficiencies, and passives.

Conclusion: D&D Beyond PDFs can be flattened. The importer cannot rely only on AcroForm fields. It needs a D&D Beyond layout parser and a user review step.

## User Flow

1. Player opens `Import Character`.
2. Player uploads a PDF.
3. App analyzes the PDF and shows an import review screen.
4. Review screen groups detected fields:
   - Identity
   - Class & level
   - Species/background
   - Ability scores
   - HP/AC/speed/proficiency
   - Saving throws/skills
   - Equipment/currency
   - Attacks
   - Spells
   - Features/traits/notes
5. Each detected field shows a confidence state:
   - Confirmed
   - Needs review
   - Not found
6. Player edits/fixes missing fields.
7. Player clicks `Create Character`.
8. App creates a normal Forge & Fable character using existing character creation/update APIs.

## Import Strategy

### Lane A: Fillable PDF Import

Use when the PDF has actual form fields.

Approach:

- Server reads PDF form fields.
- Map known field names to Forge & Fable fields.
- This is the easiest and most deterministic path.

Examples:

- `CharacterName` -> `character.name`
- `ClassLevel` -> `classId`, `level`
- `Race` or `Species` -> `raceId`
- `Background` -> `background`
- `STR`, `DEX`, etc. -> `abilities`

### Lane B: D&D Beyond Flattened PDF Import

Use when there are no form fields, like the sample PDF.

Approach:

- Render/extract page text with coordinates.
- Detect the sheet template by labels and page count.
- Use known D&D Beyond page regions to parse nearby values.
- Use image/OCR fallback only for fields not recoverable from text extraction.
- Always send results through the review screen.

For the sample sheet, page 1 regions should target:

- Character name: top-left banner.
- Class/level, player name, species, background, XP: top-right identity box.
- Ability scores/modifiers: left column.
- Saving throws and skill modifiers/proficiency markers: left-middle columns.
- Initiative, AC, HP, hit dice, death saves: center/right stat panels.
- Proficiencies/training: right panel.
- Actions/features snippet: lower middle.
- Weapon attacks/cantrips: bottom-right table.

Pages 2-4:

- Features & traits.
- Equipment.
- Attuned magic items.
- Additional equipment/features.

Page 5:

- Alignment.
- Appearance.
- Backstory.
- Personality traits, ideals, bonds, flaws.
- Allies/organizations.
- Notes.

Pages 6-7:

- Spellcasting class/ability/DC/attack bonus.
- Spell list rows.

### Lane C: Generic PDF Import

Use for non-D&D Beyond sheets.

Approach:

- Try form fields first.
- Try common label matching.
- Ask the player to review and manually fill missing sections.
- Do not attempt to support every custom PDF perfectly in v1.

## Data Mapping

### Direct Character Fields

Map into existing `Character` fields:

- `name`
- `level`
- `raceId`
- `classId`
- `background`
- `alignment`
- `abilities`
- `currentHp`
- `maxHp`
- `tempHp`
- `skillProficiencies`
- `savingThrowProficiencies`
- `toolProficiencies`
- `languages`
- `currency`
- `inventory`
- `spellsKnown`
- `preparedSpells`
- `spellSlotsUsed`
- `equipment`
- `physicalCharacteristics`
- `personalCharacteristics`
- `generalNotes`
- `pages`

### Derived Or Computed Fields

Forge & Fable should prefer its own rules engine over imported totals.

Examples:

- Imported AC should be used as a review hint, not blindly saved as AC.
- If imported AC does not match equipment-derived AC, show a mismatch:
  `Imported AC 21; Forge & Fable calculates 19. Add custom AC bonus +2?`
- Imported initiative should be used as a hint. If it differs from Dex/rules/effects, offer a custom initiative rule.
- Imported passive scores should not be persisted directly unless the app gains explicit passive override fields.

### Text-Only Sections

Some imported data will not map cleanly to rules data.

Suggested handling:

- Features that already exist from class/species should not be duplicated.
- Unknown features go into a generated custom page titled `Imported Features`.
- Backstory/personality/notes go into existing notes or pages.
- Unknown spells should remain in an `Unmatched Spells` review section.
- Unknown items become inventory entries with notes.

## Matching Rules

### Class/Species/Background

Normalize text:

- Lowercase.
- Remove punctuation.
- Collapse spaces.
- Handle old terms: `race` -> `species`.

Examples:

- `Paladin 8` -> class `paladin`, level `8`.
- `Human` -> species `human`.
- `Knight` -> background `Knight` as free text if not in the ruleset.

### Spells

Match by normalized spell name against the loaded spell catalog.

If multiple matches:

- Prefer class spell list.
- Prefer exact normalized name.
- Otherwise require review.

### Items

Match by normalized item name against:

- Equipped weapon/armor tables.
- Item catalog.
- Manual inventory fallback.

Unknown items should still import as inventory rows with name/notes.

## Proposed Technical Design

### API Routes

Add:

```text
POST /api/import/pdf/analyze
POST /api/import/pdf/create
```

`analyze`:

- Auth required.
- Accepts one PDF file.
- Size limit: 10 MB.
- Reject non-PDF MIME/file signature.
- Does not persist original PDF by default.
- Returns an `ImportDraft`.

`create`:

- Auth required.
- Accepts reviewed `ImportDraft`.
- Validates through existing character validation.
- Creates a normal character.

### Server Modules

Suggested files:

```text
src/lib/import/pdfTypes.ts
src/lib/import/pdfAnalyze.ts
src/lib/import/pdfFormFields.ts
src/lib/import/dndBeyondPdf.ts
src/lib/import/importMapper.ts
src/lib/import/importConfidence.ts
```

### Client Components

Suggested files:

```text
src/components/CharacterImportModal.tsx
src/components/ImportReviewPanel.tsx
src/components/ImportFieldRow.tsx
```

Entry point:

- Add `Import PDF` beside `New character` in the vault rail or character start panel.

## ImportDraft Shape

```ts
type ImportConfidence = "confirmed" | "review" | "missing";

type ImportField<T> = {
  value: T | null;
  confidence: ImportConfidence;
  source?: string;
  note?: string;
};

type ImportDraft = {
  source: {
    kind: "dnd-beyond" | "fillable-pdf" | "generic-pdf";
    pages: number;
  };
  identity: {
    name: ImportField<string>;
    className: ImportField<string>;
    level: ImportField<number>;
    species: ImportField<string>;
    background: ImportField<string>;
  };
  abilities: Record<AbilityKey, ImportField<number>>;
  vitals: {
    maxHp: ImportField<number>;
    currentHp: ImportField<number>;
    tempHp: ImportField<number>;
    armorClass: ImportField<number>;
    initiative: ImportField<number>;
    speed: ImportField<string>;
  };
  proficiencies: {
    savingThrows: ImportField<string[]>;
    skills: ImportField<string[]>;
    armor: ImportField<string[]>;
    weapons: ImportField<string[]>;
    languages: ImportField<string[]>;
    tools: ImportField<string[]>;
  };
  attacks: Array<ImportField<{
    name: string;
    hit: string;
    damage: string;
    notes: string;
  }>>;
  inventory: Array<ImportField<{
    name: string;
    quantity?: number;
    weight?: number;
    notes?: string;
  }>>;
  spells: Array<ImportField<{
    name: string;
    level?: number;
    prepared?: boolean;
  }>>;
  notes: {
    features: ImportField<string>;
    backstory: ImportField<string>;
    personality: ImportField<string>;
    appearance: ImportField<string>;
  };
};
```

## Review Screen Requirements

The review UI is mandatory.

It should:

- Show a clear summary: `We found a Level 8 Human Paladin named Wexford the Oathbreaker`.
- Use color/status tags for confidence.
- Let users edit values inline.
- Let users choose the matched Forge & Fable class/species/spell/item when ambiguous.
- Show derived-stat mismatches before creation.
- Allow skipping unknown fields.
- Require name, class, species, level, and ability scores before creation.

## Security And Privacy

- PDF uploads must require login.
- Do not store original PDFs unless a future debug mode explicitly enables it.
- Limit upload size.
- Reject encrypted PDFs in v1 unless password support is intentionally added.
- Strip scripts/attachments from any PDF handling path.
- Store only parsed character data after the user confirms.

## MVP Scope

MVP should support:

1. Fillable PDFs with form fields.
2. D&D Beyond 2018-style flattened PDFs like the sample.
3. Identity, class/level, species, background.
4. Ability scores.
5. HP, AC as a review hint, initiative as a review hint.
6. Saving throw and skill proficiencies.
7. Weapon attack rows.
8. Proficiencies/training text.
9. Spells by name.
10. Equipment by name.
11. Review and create.

MVP should not promise:

- Perfect import from scans/photos.
- Perfect support for every custom sheet.
- Fully automated subclass/feat reconstruction.
- Exact reconstruction of every D&D Beyond feature toggle.
- Direct import of paid source metadata.

## Acceptance Criteria

Using `AWESOMEOH_75969686.pdf`:

- Analyze returns source kind `dnd-beyond`, pages `7`.
- Review shows:
  - Character name `Wexford the Oathbreaker`.
  - Class `Paladin`, level `8`.
  - Species `Human`.
  - Background `Knight`.
  - Ability scores: STR 19, DEX 14, CON 19, INT 18, WIS 17, CHA 15.
  - Max HP 78.
  - AC review hint 21.
  - Initiative review hint +2.
  - At least the visible weapon rows from page 1.
  - At least visible proficiencies/languages from page 1.
- User can correct fields before creation.
- Created character opens on the normal Forge & Fable sheet.
- No imported PDF file remains in app storage after creation.
- Import failure shows useful errors and does not create a partial character.

## Suggested Phasing

### Phase 1: Infrastructure And Review UI

- Add upload route.
- Add `ImportDraft` types.
- Add review modal.
- Add manual-create path from reviewed import draft.

### Phase 2: Fillable PDF Parser

- Implement form field extraction.
- Add field-name mapping table.
- Verify with at least one fillable PDF.

### Phase 3: D&D Beyond Parser

- Implement D&D Beyond sheet detection.
- Add page-region parser for the 2018 layout.
- Add OCR fallback only where coordinate text extraction fails.
- Verify against `AWESOMEOH_75969686.pdf`.

### Phase 4: Smarter Mapping

- Improve spell/item matching.
- Add derived-stat mismatch suggestions.
- Add unmatched-data handling into pages/notes.

### Phase 5: Generic Imports

- Add best-effort generic label parser.
- Keep confidence low and review-heavy.

## Open Questions

- Should original PDFs ever be retained for debugging, or always discarded?
- Should low-confidence imports be allowed to create a character if required fields are manually completed?
- Should imported AC/initiative mismatches automatically create custom rules, or only suggest them?
- Should imports create custom pages for unknown features by default?
