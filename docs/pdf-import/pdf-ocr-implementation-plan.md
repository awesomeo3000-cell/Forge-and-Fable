# Forge & Fable
## PDF Import OCR Preprocessing Implementation Plan

### Purpose

Improve the existing PDF character import workflow by adding an automatic OCR preprocessing stage for image-based or poorly searchable PDFs.

The implementation should:

1. Preserve the current fast path for PDFs that already contain usable text
2. Detect when a PDF does not contain enough readable text
3. Run OCR automatically only when needed
4. Feed the OCR-enhanced PDF into the existing importer
5. Preserve the original uploaded file
6. Show the user clear processing progress
7. Return a review screen for uncertain imported fields
8. Run OCR in an isolated, resource-limited worker
9. Avoid breaking the current importer while the new workflow is introduced
10. Produce structured diagnostics so future parser improvements are easier

Repository root:

```text
E:\forge-and-fable
```

---

# 1. Recommended technical approach

Use:

```text
OCRmyPDF
+
Tesseract OCR
+
existing Forge & Fable PDF importer
+
template-aware D&D Beyond parsing
+
confidence-based review
```

Do not OCR every uploaded PDF.

The workflow should first attempt normal PDF text extraction. OCR should run only when the document fails a text-quality assessment.

Recommended flow:

```text
Upload PDF
    ↓
Validate file
    ↓
Save temporary original
    ↓
Extract existing text
    ↓
Assess text quality
    ├── Usable text
    │      ↓
    │  Existing parser
    │
    └── Poor or missing text
           ↓
       OCR worker
           ↓
       OCR-enhanced PDF
           ↓
       Existing parser
           ↓
       Structured field validation
           ↓
       Review screen
```

---

# 2. Architectural constraints

## 2.1 Preserve the existing application architecture

Do not rebuild Forge & Fable around a new import service.

Add OCR as a preprocessing layer around the current importer.

The existing import logic should remain usable independently.

Recommended separation:

```text
PDF upload
PDF assessment
OCR preprocessing
Text extraction
D&D Beyond parsing
Field confidence
Review
Character creation
```

Each stage should have its own module and diagnostics.

## 2.2 Never overwrite the original PDF

The original upload should remain untouched for the duration of the import job.

Use temporary files such as:

```text
input-original.pdf
input-ocr.pdf
extracted-text.json
parse-result.json
```

The OCR-enhanced file is a temporary derivative.

## 2.3 Keep OCR outside the main web process

Do not run OCR directly inside the request-handling thread.

Use one of:

```text
Preferred:
Dockerized OCR worker

Acceptable for local development:
isolated child process

Future scaling option:
queue-backed worker service
```

OCR is CPU and memory intensive. It should not block the main application server.

---

# 3. Proposed repository structure

Adapt paths to the actual project conventions after auditing the repository.

Recommended structure:

```text
E:\forge-and-fable
│
├── src
│   ├── app
│   │   └── import
│   │
│   ├── components
│   │   └── pdf-import
│   │       ├── PdfImportDropzone.tsx
│   │       ├── PdfImportProgress.tsx
│   │       ├── PdfImportReview.tsx
│   │       ├── PdfImportError.tsx
│   │       └── PdfImportSummary.tsx
│   │
│   ├── server
│   │   ├── pdf-import
│   │   │   ├── validatePdfUpload.ts
│   │   │   ├── createPdfImportJob.ts
│   │   │   ├── assessPdfText.ts
│   │   │   ├── extractPdfText.ts
│   │   │   ├── runPdfOcr.ts
│   │   │   ├── parseCharacterSheet.ts
│   │   │   ├── calculateFieldConfidence.ts
│   │   │   ├── finalizeCharacterImport.ts
│   │   │   └── cleanupPdfImportJob.ts
│   │   │
│   │   └── routes
│   │       └── pdfImportRoutes.ts
│   │
│   ├── parsers
│   │   └── dnd-beyond
│   │       ├── detectTemplate.ts
│   │       ├── parseIdentity.ts
│   │       ├── parseAbilities.ts
│   │       ├── parseSavingThrows.ts
│   │       ├── parseSkills.ts
│   │       ├── parseCombatStats.ts
│   │       ├── parseEquipment.ts
│   │       ├── parseFeatures.ts
│   │       ├── parseSpells.ts
│   │       └── parserTypes.ts
│   │
│   └── types
│       └── pdfImport.ts
│
├── workers
│   └── ocr
│       ├── Dockerfile
│       ├── process-ocr.sh
│       └── README.md
│
├── data
│   └── imports
│       └── .gitkeep
│
├── scripts
│   ├── test-pdf-import.mjs
│   ├── benchmark-pdf-import.mjs
│   └── clean-import-temp.mjs
│
├── tests
│   ├── fixtures
│   │   └── pdf-import
│   └── pdf-import
│
└── docker-compose.ocr.yml
```

Do not create all files blindly.

The implementation agent must first identify:

- Current route conventions
- Current upload handling
- Current importer location
- Current parser location
- Current server runtime
- Existing job or queue infrastructure
- Existing database tables
- Existing temporary file conventions
- Existing test framework

---

# 4. Phase 0: repository audit

Before changing code, inspect the current importer.

The audit must answer:

## Current upload flow

- Where does the upload begin?
- Is it a browser-only importer or server-backed?
- Does the uploaded PDF already reach the server?
- What library currently extracts PDF text?
- Does the importer read AcroForm fields?
- Does it read page text?
- Does it parse page coordinates?
- Does it process D&D Beyond exports differently from generic PDFs?

## Current parser

- Which fields are currently imported?
- Which fields fail most often?
- Is the parser based on exact labels?
- Does it rely on text ordering?
- Does it use regex?
- Does it understand pages separately?
- Does it preserve debug evidence?
- Does it already expose confidence?

## Current persistence

- Is the imported character saved immediately?
- Is there already a confirmation step?
- Is partial import supported?
- Are uploaded PDFs retained?
- Is there an import history table?
- Are temporary files already cleaned?

## Current runtime

- Node version
- Framework
- Deployment environment
- Windows local development behavior
- Docker availability
- Production filesystem behavior
- Maximum request size
- Reverse proxy limits
- Current timeout behavior

Deliver:

```text
docs/pdf-import/current-import-audit.md
```

Do not begin OCR integration until the audit is complete.

---

# 5. Import job model

Use a durable import-job record rather than holding everything in one request.

Recommended status model:

```ts
export type PdfImportStatus =
  | "created"
  | "uploading"
  | "uploaded"
  | "validating"
  | "extracting-text"
  | "assessing-text"
  | "ocr-required"
  | "ocr-queued"
  | "ocr-processing"
  | "ocr-complete"
  | "parsing"
  | "review-required"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";
```

Recommended record:

```ts
export type PdfImportJob = {
  id: string;
  userId?: string;

  status: PdfImportStatus;

  originalFilename: string;
  originalPath: string;
  ocrPath?: string;

  mimeType: "application/pdf";
  sizeBytes: number;
  pageCount?: number;

  requiresOcr?: boolean;
  ocrReason?: string;
  ocrDurationMs?: number;

  extractedCharacterCount?: number;
  pagesWithText?: number;
  textQualityScore?: number;

  parserId?: string;
  parserVersion?: string;

  progressPercent: number;
  progressMessage?: string;

  parseResultPath?: string;
  errorCode?: string;
  errorMessage?: string;

  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
```

The job may initially be stored:

```text
Preferred:
SQLite table

Acceptable for first local-only pass:
temporary JSON metadata files
```

A database-backed job model is safer if imports survive page refreshes.

---

# 6. API design

Adapt to existing route conventions.

Recommended endpoints:

## Create job and upload

```text
POST /api/pdf-imports
```

Request:

```text
multipart/form-data
file=<pdf>
```

Response:

```json
{
  "jobId": "imp_123",
  "status": "uploaded"
}
```

## Read job status

```text
GET /api/pdf-imports/:jobId
```

Response:

```json
{
  "id": "imp_123",
  "status": "ocr-processing",
  "progressPercent": 45,
  "progressMessage": "Recognizing text on page 2 of 4"
}
```

## Read parsed result

```text
GET /api/pdf-imports/:jobId/result
```

## Confirm reviewed fields

```text
POST /api/pdf-imports/:jobId/confirm
```

Request:

```json
{
  "fields": {
    "name": "Rhea Voss",
    "level": 5,
    "className": "Ranger"
  }
}
```

## Cancel job

```text
POST /api/pdf-imports/:jobId/cancel
```

## Delete job

```text
DELETE /api/pdf-imports/:jobId
```

Do not expose local filesystem paths to the browser.

---

# 7. Upload validation

Validate before text extraction or OCR.

## Required checks

- Actual PDF signature
- MIME type
- File extension
- Maximum file size
- Maximum page count
- Encrypted PDF detection
- Malformed PDF detection
- Embedded file detection where practical
- Processing timeout
- Duplicate job protection
- Current user authorization

Recommended starting limits:

```text
Maximum file size: 25 MB
Maximum pages: 12
Maximum concurrent OCR jobs: 2
Maximum OCR duration: 180 seconds
Temporary retention: 60 minutes
```

These should be configuration values.

Example:

```ts
export const PDF_IMPORT_LIMITS = {
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxPages: 12,
  maxOcrDurationMs: 180_000,
  tempRetentionMs: 60 * 60 * 1000,
  maxConcurrentOcrJobs: 2,
} as const;
```

---

# 8. Existing-text extraction

The first pass should use the current extractor.

Do not replace the current extraction library during the OCR phase unless the audit proves it is the primary problem.

The extractor should return:

```ts
export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
  characterCount: number;
  wordCount: number;
  textItems?: Array<{
    text: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>;
};

export type ExtractedPdfText = {
  pages: ExtractedPdfPage[];
  fullText: string;
  totalCharacters: number;
  totalWords: number;
};
```

Preserve page boundaries.

If coordinates are available, preserve them.

D&D character sheets often depend on spatial relationships.

---

# 9. OCR decision engine

Do not use one threshold alone.

The OCR decision should consider:

- Average characters per page
- Percentage of pages with text
- Presence of expected character-sheet labels
- Amount of gibberish
- Repeated replacement characters
- Text-item count
- Whether form values were found
- Whether major parser sections succeeded

Recommended assessment:

```ts
export type PdfTextAssessment = {
  pageCount: number;
  totalCharacters: number;
  pagesWithText: number;
  averageCharactersPerPage: number;

  expectedAnchorsFound: string[];
  expectedAnchorScore: number;

  suspiciousCharacterRatio: number;
  textCoverageScore: number;
  parserProbeScore: number;

  requiresOcr: boolean;
  reasons: string[];
  overallScore: number;
};
```

Expected anchors may include:

```text
Character Name
Class
Level
Species
Race
Background
Armor Class
Initiative
Speed
Hit Points
Proficiency Bonus
Strength
Dexterity
Constitution
Intelligence
Wisdom
Charisma
Saving Throws
Skills
Equipment
Features and Traits
Spellcasting
```

Example initial decision function:

```ts
export function shouldRunOcr(
  assessment: PdfTextAssessment
): boolean {
  if (assessment.pageCount === 0) {
    return true;
  }

  if (assessment.textCoverageScore < 0.35) {
    return true;
  }

  if (assessment.expectedAnchorScore < 0.25) {
    return true;
  }

  if (assessment.parserProbeScore < 0.30) {
    return true;
  }

  if (assessment.suspiciousCharacterRatio > 0.08) {
    return true;
  }

  return false;
}
```

These values are starting points.

They must be calibrated using actual test PDFs.

---

# 10. OCR worker

## 10.1 Recommended OCR command

Start with:

```bash
ocrmypdf \
  --mode skip \
  --rotate-pages \
  --deskew \
  --clean \
  --language eng \
  --output-type pdf \
  input-original.pdf \
  output-ocr.pdf
```

Do not use force mode as the default.

Force mode may rasterize pages and remove useful PDF structure.

## 10.2 Worker responsibilities

The OCR worker should:

1. Receive an input path and output path
2. Verify both paths are inside the allowed temporary directory
3. Run OCRmyPDF
4. Enforce timeout
5. Capture progress
6. Capture stderr
7. Return a structured result
8. Never retain uploaded files permanently
9. Run without network access
10. Run as a non-root user

## 10.3 Node integration

Example contract:

```ts
export type OcrRequest = {
  jobId: string;
  inputPath: string;
  outputPath: string;
  language: string;
  timeoutMs: number;
};

export type OcrResult = {
  success: boolean;
  outputPath?: string;
  durationMs: number;
  exitCode?: number;
  stderr?: string;
};
```

The main app should not pass raw user-controlled paths directly into a shell command.

Use `spawn` with an argument array.

Do not use string interpolation with `exec`.

---

# 11. Dockerized OCR service

## 11.1 Recommended initial Dockerfile

Create:

```text
workers/ocr/Dockerfile
```

Responsibilities:

- Install OCRmyPDF
- Install Tesseract English language data
- Install required PDF utilities
- Create non-root user
- Set a dedicated work directory
- Expose no public network service unless needed
- Use a minimal entrypoint

## 11.2 Docker Compose

Create:

```text
docker-compose.ocr.yml
```

Suggested properties:

```yaml
services:
  ocr-worker:
    build:
      context: ./workers/ocr
    network_mode: "none"
    read_only: true
    tmpfs:
      - /tmp:size=512m
    volumes:
      - ./data/imports:/work
    mem_limit: 1g
    cpus: 2
    security_opt:
      - no-new-privileges:true
```

Exact Compose support depends on the local Docker environment.

Do not assume all resource options work identically across development and deployment.

## 11.3 Windows development

The repository is located at:

```text
E:\forge-and-fable
```

Mount:

```text
E:\forge-and-fable\data\imports
```

into the worker as:

```text
/work
```

The application should store relative import-job paths.

Do not save Windows drive-letter paths in persisted records intended for production.

---

# 12. Job queue

## First implementation

Use a small in-process queue with a concurrency limit if:

- The app is used by a small private group
- Only one server process exists
- Imports do not need to survive a restart
- Deployment is simple

Recommended:

```ts
const OCR_CONCURRENCY = 2;
```

## Future implementation

Use a durable queue if:

- Multiple users import simultaneously
- The app runs across multiple processes
- Deployment can restart workers
- Import jobs must survive restarts

Possible future queue model:

```text
SQLite-backed job polling
or
Redis-backed queue
```

Do not add Redis solely for the first implementation unless the project already uses it.

---

# 13. Progress reporting

OCR and parsing should not leave the user staring at one indefinite spinner.

Use stages:

```text
Uploading PDF
Checking document
Reading existing text
Preparing OCR
Recognizing text
Reading character details
Checking imported values
Ready for review
```

Recommended progress allocation:

```text
Upload: 0–15%
Validation: 15–20%
Text extraction: 20–30%
Text assessment: 30–35%
OCR: 35–70%
Parsing: 70–90%
Validation: 90–96%
Review preparation: 96–100%
```

Progress does not need to represent exact CPU completion.

It should represent truthful workflow stages.

Use polling initially:

```text
GET /api/pdf-imports/:jobId
every 1 to 2 seconds
```

WebSockets or Server-Sent Events are optional later.

---

# 14. User-facing import states

## Usable text

```text
Reading your character sheet…
```

## OCR required

```text
This PDF does not contain enough readable text.
Preparing it for import…
```

## OCR processing

```text
Recognizing text on your character sheet…
```

## Parsing

```text
Matching the imported details to your character…
```

## Review

```text
Your character is ready to review.
```

## Partial result

```text
We imported most of the character sheet.
A few fields need your attention.
```

## Failure

```text
We could not read this PDF reliably.
You can try another export or enter the remaining details manually.
```

Do not describe OCR as an error.

It is an automatic compatibility step.

---

# 15. D&D Beyond template detection

OCR alone will not solve reading order.

Add template detection.

Recommended template identifiers:

```ts
export type CharacterSheetTemplate =
  | "dnd-beyond-2014"
  | "dnd-beyond-2024"
  | "official-2014-sheet"
  | "official-2024-sheet"
  | "generic-5e-sheet"
  | "unknown";
```

Detection signals may include:

- Page count
- Known labels
- Label order
- Header strings
- Footer strings
- Coordinate clusters
- Rules terminology
- Presence of weapon mastery
- Species versus race terminology
- Spell-page layout
- D&D Beyond branding where text is available

The parser should record:

```ts
{
  templateId: "dnd-beyond-2024",
  confidence: 0.94
}
```

Unknown templates should still attempt generic parsing.

---

# 16. Modular parser design

Replace or wrap any monolithic parser with modules.

## Identity parser

Fields:

- Name
- Level
- Class
- Subclass
- Species
- Background
- Alignment
- Experience points
- Player name

## Ability parser

Fields:

- Strength
- Dexterity
- Constitution
- Intelligence
- Wisdom
- Charisma
- Ability modifiers

## Saving throw parser

Fields:

- Saving throw bonuses
- Proficiency state

## Skill parser

Fields:

- Skill bonuses
- Proficiency
- Expertise

## Combat parser

Fields:

- Armor Class
- Initiative
- Speed
- Maximum HP
- Current HP
- Temporary HP
- Hit dice
- Death saves
- Proficiency bonus

## Attack parser

Fields:

- Weapon or attack name
- Attack bonus
- Damage
- Damage type
- Notes

## Equipment parser

Fields:

- Currency
- Items
- Quantities
- Armor
- Weapons
- Tools
- Packs
- Attuned items

## Feature parser

Fields:

- Features
- Traits
- Feats
- Languages
- Proficiencies

## Spell parser

Fields:

- Spellcasting ability
- Spell save DC
- Spell attack bonus
- Spell slots
- Known or prepared spells
- Cantrips

Each parser should return evidence and confidence.

---

# 17. Field result model

Use:

```ts
export type ExtractedField<T> = {
  value: T | null;
  confidence: number;

  status:
    | "confirmed"
    | "probable"
    | "review"
    | "missing"
    | "conflict";

  evidence: Array<{
    page: number;
    text: string;
    x?: number;
    y?: number;
  }>;

  parserId: string;
  parserVersion: string;

  warnings?: string[];
};
```

Example:

```ts
const armorClass: ExtractedField<number> = {
  value: 16,
  confidence: 0.96,
  status: "confirmed",
  evidence: [
    {
      page: 1,
      text: "ARMOR CLASS 16",
    },
  ],
  parserId: "dnd-beyond-2024",
  parserVersion: "1.0.0",
};
```

Do not reduce all parser output to a plain character object before review.

Preserve confidence and evidence.

---

# 18. Confidence policy

Suggested thresholds:

```text
0.90–1.00
Confirmed

0.75–0.89
Probable

0.50–0.74
Review required

Below 0.50
Missing or unreliable
```

Critical fields should require stricter review.

Critical fields:

- Character name
- Level
- Class
- Species
- Ability scores
- Maximum HP
- Armor Class
- Spell save DC
- Spell attack bonus

Example:

```ts
function requiresManualReview(
  fieldName: string,
  field: ExtractedField<unknown>
): boolean {
  const criticalFields = new Set([
    "name",
    "level",
    "className",
    "species",
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
    "maxHitPoints",
    "armorClass",
    "spellSaveDc",
    "spellAttackBonus",
  ]);

  const minimumConfidence =
    criticalFields.has(fieldName) ? 0.90 : 0.75;

  return (
    field.value == null ||
    field.confidence < minimumConfidence ||
    field.status === "conflict"
  );
}
```

---

# 19. Review screen

The review screen is required even after OCR.

## Layout

Group fields into:

```text
Identity
Core Stats
Combat
Proficiencies
Equipment
Features
Spells
```

Show:

- Imported value
- Confidence state
- Original evidence where useful
- Editable input
- Warning when values conflict
- Clear confirmation action

## Visual states

```text
Confirmed
Probable
Needs Review
Missing
Conflict
```

Do not communicate states with color alone.

## Summary

Example:

```text
42 fields imported
35 confirmed
5 probable
2 need review
```

## Final action

```text
Create Character
```

Do not save the character automatically before the user confirms critical fields.

---

# 20. Import diagnostics

Create a development-only diagnostics view.

Include:

- Text assessment score
- OCR decision reasons
- Original extracted text
- OCR extracted text
- Template detection result
- Parser results
- Field confidence
- Parsing warnings
- Processing durations
- Worker stderr
- Cleanup status

Suggested route:

```text
/dev/pdf-imports/:jobId
```

Protect it from ordinary users.

This is essential for improving inconsistent imports.

---

# 21. Security

Treat every uploaded PDF as hostile.

## Required controls

- File signature validation
- File-size limit
- Page-count limit
- Timeout
- CPU limit
- Memory limit
- No outbound worker network
- Non-root worker
- Temporary isolated directory
- Random job IDs
- Sanitized filenames
- No shell interpolation
- Automatic cleanup
- User authorization for every job read
- Error-message sanitization
- Limited concurrency
- Audit logging

## Do not

- Trust `.pdf` extension
- Store original filenames as filesystem names
- Run OCR as administrator
- Pass user filenames into shell strings
- Leave files indefinitely
- Return internal paths to the browser
- Expose raw OCR logs to users
- Allow unlimited simultaneous OCR

---

# 22. Temporary file lifecycle

Suggested directory:

```text
data/imports/<job-id>/
```

Example:

```text
data/imports/imp_123/
  original.pdf
  ocr.pdf
  extracted-original.json
  extracted-ocr.json
  result.json
  diagnostics.json
```

Cleanup policy:

```text
Completed jobs:
delete files after 60 minutes

Failed jobs:
delete files after diagnostics are saved

Cancelled jobs:
delete immediately

Expired jobs:
delete with scheduled cleanup task
```

Create:

```text
npm run cleanup:pdf-imports
```

Also run cleanup:

- On server start
- On a timer
- After successful completion
- After cancellation

---

# 23. Error taxonomy

Use machine-readable errors.

```ts
export type PdfImportErrorCode =
  | "INVALID_FILE_TYPE"
  | "INVALID_PDF_SIGNATURE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "PDF_ENCRYPTED"
  | "PDF_MALFORMED"
  | "TEXT_EXTRACTION_FAILED"
  | "OCR_UNAVAILABLE"
  | "OCR_TIMEOUT"
  | "OCR_FAILED"
  | "OCR_OUTPUT_MISSING"
  | "PARSER_UNSUPPORTED"
  | "PARSER_FAILED"
  | "REVIEW_RESULT_INVALID"
  | "IMPORT_FINALIZATION_FAILED"
  | "JOB_EXPIRED"
  | "JOB_NOT_FOUND"
  | "JOB_ACCESS_DENIED";
```

User-facing errors should remain plain and helpful.

Internal diagnostics should preserve technical detail.

---

# 24. Feature flag rollout

Add a feature flag.

Example:

```text
PDF_IMPORT_OCR_ENABLED=true
```

Optional flags:

```text
PDF_IMPORT_OCR_FORCE=false
PDF_IMPORT_OCR_DEBUG=false
PDF_IMPORT_OCR_MAX_CONCURRENCY=2
PDF_IMPORT_OCR_TIMEOUT_MS=180000
```

Rollout phases:

## Phase 1

Developer-only testing.

## Phase 2

Enabled for selected users.

## Phase 3

Enabled automatically only when assessment requests OCR.

## Phase 4

Enabled for all PDF imports.

Do not remove the previous importer until the OCR workflow has proven stable.

---

# 25. Test fixture library

Create a representative fixture set.

Do not commit copyrighted full character sheets unless permitted.

Use private local fixtures where necessary.

Required fixture categories:

```text
1. Searchable D&D Beyond export
2. Non-searchable D&D Beyond export
3. Mixed searchable and image pages
4. Scanned character sheet
5. Rotated page
6. Skewed page
7. Low-resolution export
8. 2014 sheet
9. 2024 sheet
10. Multiclass character
11. Spellcaster
12. Martial character
13. Character with long equipment list
14. Character with many features
15. Blank character sheet
16. Password-protected PDF
17. Malformed PDF
18. Oversized PDF
19. Unsupported generic sheet
20. Handwritten sheet
```

Handwriting should be expected to fail or require extensive review.

---

# 26. Unit tests

## Validation

- Reject non-PDF files
- Reject invalid PDF signature
- Reject oversized files
- Reject too many pages
- Reject encrypted files where unsupported

## Assessment

- Searchable PDF does not trigger OCR
- Image-only PDF triggers OCR
- Mixed PDF triggers skip-mode OCR
- Gibberish extraction triggers OCR
- Good anchors prevent unnecessary OCR

## OCR runner

- Builds safe argument array
- Enforces timeout
- Handles missing binary
- Handles nonzero exit
- Handles missing output
- Cleans temporary files

## Parser

- Detects 2014 D&D Beyond template
- Detects 2024 D&D Beyond template
- Preserves page evidence
- Returns confidence
- Flags conflicting values
- Handles missing fields

## Job model

- Valid status transitions
- Prevents unauthorized access
- Expires jobs
- Cancels safely
- Cleans files

---

# 27. Integration tests

Test full workflows:

## Searchable PDF

```text
Upload
→ assess
→ skip OCR
→ parse
→ review
→ create character
```

## Image-only PDF

```text
Upload
→ assess
→ OCR
→ extract
→ parse
→ review
→ create character
```

## OCR failure

```text
Upload
→ assess
→ OCR fails
→ user receives useful error
→ original importer does not create corrupt character
```

## Low-confidence parse

```text
Upload
→ OCR
→ parse
→ review required
→ user edits values
→ character created correctly
```

## Refresh during job

```text
Upload
→ OCR processing
→ browser refresh
→ job restored
→ progress continues
```

---

# 28. Manual QA matrix

Test at minimum:

## Browsers

- Chrome
- Edge
- Firefox
- Safari where supported

## Viewports

- 1920px desktop
- 1366px desktop
- 1024px tablet landscape
- 768px tablet portrait
- 390px mobile

## Accessibility

- Keyboard-only
- Screen reader
- 200 percent zoom
- Reduced motion
- Visible focus
- Error announcement
- Progress announcement

## Runtime

- OCR installed
- OCR unavailable
- Worker stopped
- Disk full
- Timeout
- Concurrent imports
- Server restart
- Expired job

---

# 29. Performance targets

Starting targets:

```text
Searchable PDF:
under 5 seconds for assessment and parsing

Image-only 4-page PDF:
under 45 seconds on typical development hardware

Import status response:
under 250 ms

Progress polling:
no more frequent than once per second

Worker concurrency:
2 maximum initially
```

Measure actual values.

Do not treat these as guarantees before benchmarking.

Create:

```text
npm run benchmark:pdf-import
```

Report:

- Upload duration
- Extraction duration
- Assessment duration
- OCR duration
- Parsing duration
- Total duration
- Peak memory where available
- Page count
- File size

---

# 30. Logging

Use structured logs.

Example:

```json
{
  "event": "pdf_import_ocr_complete",
  "jobId": "imp_123",
  "pageCount": 4,
  "durationMs": 21842,
  "textCharactersBefore": 103,
  "textCharactersAfter": 8421,
  "templateId": "dnd-beyond-2024"
}
```

Do not log full extracted character-sheet text in production.

Do not log private character details unless needed for debugging and protected appropriately.

---

# 31. Metrics

Track:

- Total PDF imports
- Percentage requiring OCR
- OCR success rate
- OCR timeout rate
- Average OCR duration
- Parser success rate
- Average fields requiring review
- Import abandonment rate
- Template distribution
- Most frequently unresolved fields
- Most frequently failing pages
- Fallback-to-manual rate

These metrics will reveal whether OCR or parsing remains the larger problem.

---

# 32. Implementation phases

## Phase 1: audit and instrumentation

Deliver:

- Current importer audit
- Existing failure examples
- Diagnostics logging
- Baseline import tests
- Fixture plan

No OCR yet.

## Phase 2: conditional OCR proof of concept

Deliver:

- Text assessment
- OCR worker
- Manual local OCR trigger
- Re-extraction from OCR PDF
- Developer diagnostics

No user-facing automatic OCR yet.

## Phase 3: import-job workflow

Deliver:

- Job model
- Status endpoint
- Progress polling
- Timeout
- Cancellation
- Cleanup

## Phase 4: automatic OCR

Deliver:

- OCR decision engine
- Automatic queueing
- Progress messages
- Failure handling
- Feature flag

## Phase 5: parser hardening

Deliver:

- Template detection
- Modular D&D Beyond parser
- Field confidence
- Evidence
- Review queue

## Phase 6: review screen

Deliver:

- Grouped fields
- Editing
- Confirmed/probable/review states
- Final character creation
- Validation

## Phase 7: security and deployment hardening

Deliver:

- Container isolation
- Resource limits
- No network
- File validation
- Cleanup
- Authorization
- Sanitized errors

## Phase 8: rollout

Deliver:

- Developer testing
- Selected-user rollout
- Metrics
- Full release
- Legacy importer fallback

---

# 33. Suggested implementation tasks

## Task 1

Audit the current importer.

## Task 2

Create import-job types.

## Task 3

Create secure upload validation.

## Task 4

Wrap current text extraction in a structured result.

## Task 5

Implement text-quality assessment.

## Task 6

Create OCR worker Dockerfile.

## Task 7

Create safe OCR process runner.

## Task 8

Create limited-concurrency queue.

## Task 9

Create status polling API.

## Task 10

Create temporary file cleanup.

## Task 11

Add template detection.

## Task 12

Split parser into modules.

## Task 13

Add confidence and evidence.

## Task 14

Build review screen.

## Task 15

Add error taxonomy.

## Task 16

Add feature flags.

## Task 17

Add fixture tests.

## Task 18

Add integration tests.

## Task 19

Benchmark OCR and parsing.

## Task 20

Roll out behind feature flag.

---

# 34. Definition of done

The implementation is complete when:

1. Searchable PDFs continue through the current fast path.
2. Image-only PDFs automatically trigger OCR.
3. Mixed PDFs preserve existing text and OCR missing pages.
4. OCR runs outside the main request thread.
5. OCR has CPU, memory and time limits.
6. Uploaded files are validated.
7. Original PDFs are never overwritten.
8. Temporary files are cleaned.
9. Job progress survives a page refresh.
10. The UI clearly explains OCR processing.
11. D&D Beyond templates are detected where possible.
12. Parsed fields include confidence and evidence.
13. Critical low-confidence fields require review.
14. The user confirms before character creation.
15. Existing character imports still work.
16. Existing saved characters remain unaffected.
17. OCR failures do not create corrupt characters.
18. Worker failures produce useful errors.
19. Tests cover searchable, image-only and malformed PDFs.
20. The full workflow is available behind a feature flag.
21. Build passes.
22. Lint passes.
23. Tests pass.
24. Production logs do not expose full character-sheet contents.
25. The implementation includes documentation for local Windows development and deployment.

---

# 35. Copy-paste implementation prompt for an agent

```text
You are implementing automatic OCR preprocessing for the existing PDF character importer in the Forge & Fable repository at:

E:\forge-and-fable

Read the complete implementation plan in:

docs/pdf-import/pdf-ocr-implementation-plan.md

If that file does not exist, save the supplied “PDF Import OCR Preprocessing Implementation Plan” there before proceeding.

Your objective is to add conditional OCR without replacing or breaking the current importer.

Core architecture:

Upload PDF
→ validate
→ extract existing text
→ assess text quality
→ run OCR only when required
→ extract text again
→ parse the character sheet
→ calculate field confidence
→ show a review screen
→ create the character only after confirmation

Use OCRmyPDF with Tesseract in an isolated worker or container.

Critical requirements:

- Audit the current importer before editing it.
- Do not OCR every PDF.
- Preserve the current fast path.
- Never overwrite the original upload.
- Do not run OCR in the main request thread.
- Do not use shell-string interpolation.
- Use spawn with explicit arguments.
- Add file-size, page-count, CPU, memory and timeout limits.
- Run the OCR worker without outbound network access.
- Use a non-root worker.
- Store temporary files under a random job ID.
- Clean temporary files automatically.
- Do not expose filesystem paths to the browser.
- Add a durable import-job status model.
- Add progress polling.
- Add template detection for D&D Beyond 2014 and 2024 sheets.
- Split parsing into identity, abilities, saves, skills, combat, equipment, features and spells.
- Preserve evidence and confidence for every imported field.
- Require review for uncertain critical fields.
- Do not save a character before confirmation.
- Keep the existing importer available behind a fallback.
- Add feature flags.
- Add unit, integration and manual QA coverage.
- Run lint, build and tests before completion.

Implementation order:

1. Audit current importer
2. Add diagnostics
3. Add job types
4. Add validation
5. Structure existing extraction
6. Add text-quality assessment
7. Add OCR worker
8. Add safe OCR runner
9. Add queue and progress
10. Add automatic OCR decision
11. Add template detection
12. Modularize parser
13. Add confidence and evidence
14. Build review screen
15. Add cleanup and security
16. Add tests
17. Benchmark
18. Roll out behind feature flag

Do not pause for minor stylistic decisions. Pause only when a repository-specific architecture issue, deployment limitation or backward-compatibility problem cannot be safely resolved from the codebase.
```
