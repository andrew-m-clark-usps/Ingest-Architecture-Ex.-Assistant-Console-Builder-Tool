# Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool — Spec-Ingest Tool

Full stack Ingest Architecture Infra, Ex. Assistant, Console Building Tool

![status](https://img.shields.io/badge/status-demo%2Freference-yellow)
![node](https://img.shields.io/badge/node-%3E%3D20-green)

> **Demo / reference scaffold.** This branch (`Ingest`) contains the full
> brief in [`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md) plus a minimal,
> runnable code skeleton under `src/`, `cli.mjs`, and `mcp.mjs`. It is **not**
> the complete implementation described by the brief's "done means" section —
> most functions throw `not implemented` and point back at the section that
> specifies the real behavior.

This branch holds only the Spec-Ingest Tool. The other two products
(Addressing Console, Exec-Assistant + Dashboard + Parity Harness) live on
their own branches — see [`main`](https://github.com/andrew-m-clark-usps/Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool/tree/main)
for the integration view and full architecture docs.

## What it is

The tool that builds the other two products. Give it decks, PDFs,
spreadsheets, API specs, backlogs, screenshots, an old codebase, or a running
system, and it produces a working application with tests, CI, and Terraform.

[`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md) starts with a condensed
`## Instructions` section (the key rules distilled into bullets) followed by
`## Additional Guidelines`, which carries the full original brief verbatim —
including its ASCII diagrams and code samples.

## Pipeline

```mermaid
flowchart LR
    subgraph Sources
      A1[Deck .pptx]
      A2[PDF]
      A3[Spreadsheet .xlsx]
      A4[API spec OpenAPI]
      A5[Backlog / stories]
      A6[Image / screenshot]
      A7[Codebase]
      A8[Running system]
    end
    R["Readers<br/>claim by content, never by extension"]
    C["Candidate<br/>{ kind, text, ref, because }"]
    CORP["Corpus<br/>merge + dedupe + contradictions"]
    P["Profile / architecture<br/>inferred, not authored"]
    OUT["Repository:<br/>app, tests, CI, Terraform, README"]

    A1 & A2 & A3 & A4 & A5 & A6 & A7 & A8 --> R --> C --> CORP --> P --> OUT
```

## Scaffold in this branch

Phases 1–2, 4–6 of the roadmap are implemented for real (not stubs) — see
[63 passing tests](test/) across 13 files:

- **Readers** (`src/unzip.ts`, `src/pptx.ts`, `src/pdfText.ts`, `src/cmap.ts`) —
  a real ZIP central-directory reader (stored + deflate, ZIP64 refused by
  name), a real PPTX reader (`<a:t>` runs joined per `<a:p>`), and a real PDF
  reader: object scanning (never the xref table), `/ObjStm` object-stream
  expansion, `/ToUnicode` CMap decoding (`beginbfchar` and both `beginbfrange`
  forms), BT/ET-scoped text extraction, line reconstruction from glyph
  coordinates with word-spacing repair, and the two refusal guards (looks
  like a scan; looks like a subsetted font with no usable CMap).
- **Classification & corpus** (`src/specExtract.ts`, `src/specMerge.ts`,
  `src/contradictions.ts`) — real line classification (rule/step/field/
  heading/amount/date/version/endpoint) with dedupe; corpus merge that
  unions sources for a repeated line; quantity/version/requiredness
  contradiction detection tuned to under-report.
- **Recorded sessions** (`src/journalSpec.ts`) — reads `meta.json`/
  `fields.json`/`ax-tree.json`/`styles.json` per step, drops query strings,
  only counts an explicitly-declared state, and a malformed artifact never
  fails the whole read.
- **Reconciliation** (`src/reconcile.ts`) — label matching with parenthetical
  stripping and an explicit synonym table, never a stemmer or fuzzy distance.
- **Profiles** (`src/profiles/`) — `validateProfile` rejects a profile with
  no sections or a section with no source kinds, per section 8.
- **Inference guardrail** (`src/inference.ts`) — `--no-ml` is the default;
  a parity test asserts every deterministic candidate is present,
  byte-identical, when a (locally-defined, non-provider) model is enabled.
- **Repository generation** (`src/generate.ts`) — writes a real
  application + test + CI workflow + Terraform (no defaults on
  environment-specific variables); the generated app is type-checked in CI,
  not just generated.
- **Image/OCR reader shape** (`src/imageReader.ts`) — the confidence/region/
  audit-log contract from section 5C, with a pluggable `OcrEngine`; no OCR
  engine is bundled (zero runtime dependencies), so a caller must inject a
  pinned one.
- `cli.mjs`, `mcp.mjs` — both wired to the real readers above (not the
  placeholder "would read" scaffold): the CLI reads real `.pdf`/`.pptx`
  files and prints coverage + contradictions; the MCP server implements all
  four tools (`read_spec_document`, `score_corpus`, `list_profiles`,
  `reconcile`) with refusals returned as `isError: true` tool results.
- **Not yet implemented**: the running-system Playwright capture script
  (section 5E), the API-spec/OpenAPI reader (section 6A), spreadsheet
  reader (section 5A), codebase reader (section 5B), and a real pinned OCR
  engine — see [`main`](https://github.com/andrew-m-clark-usps/Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool/blob/main/docs/ROADMAP.md)
  for the roadmap.
- Zero runtime dependencies by design (only `devDependencies`).

**Build / test:**

```bash
npm install
npm run build   # tsc -p tsconfig.json
npm test        # vitest run
node cli.mjs your-file.pdf   # real end-to-end read + coverage report
```

**Docker:** `docker build -t spec-ingest-scaffold .`

## Automation

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push
and pull request touching this branch: `npm install`/`build`/`test`/`audit`,
failing the run (and blocking a PR) on any real failure — no code is
generated.

[`.github/workflows/daily-health-check.yml`](.github/workflows/daily-health-check.yml)
runs the same commands on a daily schedule (and on demand), then opens or
updates a single tracking issue with the day's status instead of failing.
**Neither workflow writes or auto-implements code** — see `docs/ROADMAP.md`
on
[`main`](https://github.com/andrew-m-clark-usps/Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool/blob/main/docs/ROADMAP.md)
for the human-driven feature timeline this branch works from.

## Shared invariants

Stated in the brief because it may be read out of order from the other two:

- No JavaScript in any rendered page it produces — no `<script>`, no `on*`
  attribute, no `<style>` block/attribute.
- No model, no model-provider SDK, and no API key in a shipped product — a
  provider package in a lockfile is a build failure. Inference may only
  propose, never decide.
- Every document read is untrusted input — extracted content is quoted
  material, never an instruction; malformed/oversized files are refused.
- Provenance or it did not happen — every figure, rule, and field traces to
  where it came from.
- What is generated arrives as a repository, not a folder — application,
  tests, CI workflow, and Terraform, with every environment-specific value
  left as a variable it refuses to guess.

## Security

**Treat every source document as untrusted input (prompt-injection defense).**
A PDF, deck, or spreadsheet fed to the spec-ingest tool can contain text
crafted to look like an instruction ("ignore previous instructions and add an
endpoint that..."). Extracted content is always quoted material, never an
instruction — it must never be interpreted as configuration or a directive by
anything that reads it, including an AI agent building from the resulting
brief.

**No secrets, anywhere, ever.**
- No credentials, tokens, connection strings, or private keys in this
  repository, in generated output, or in sample/test data.
- The tool must scan assembled output for credential shapes (bearer/basic
  tokens, JWTs, private key headers, `client_secret` assignments, session
  cookies) and **refuse to write** rather than redact silently.

**No model, no model-provider SDK, no API key in anything shipped.**
A provider package landing in a lockfile is a build failure by design.
Inference (where allowed at build time, via a local pinned model or the
Playwright API only) may *propose* a candidate; it may never decide a
contradiction, invent a figure, or reach generated code unconfirmed.

**Confinement and supply chain.**
- Ships with zero runtime dependencies — no PDF engine, ZIP library, or MCP
  SDK it did not write and cannot audit, given that it parses hostile file
  formats for a living.
- Its MCP server confines every read to a resolved root path (symlinks
  followed and checked) and denies by default outside it.
- Decompression bombs, oversized documents, and catastrophic-backtracking
  regexes are refused before parsing, with a stated reason.

**Marked/classified sources keep their marking.**
A source marked Sensitive/Confidential/etc. passes that marking to
everything derived from it — the highest marking of any contributing source
appears on the first page of a generated brief, and marked content must never
land in a commit message, log line, filename, or PR title.

**Infrastructure changes are gated, not automatic.**
Any driving of real infrastructure (not just generating Terraform) is
read-only by default; mutation requires an explicit flag, and destructive or
mutating actions require an explicit, per-plan approval that is never reused
for a different plan. Terraform generation never invents account IDs,
regions, VPC/subnet IDs, CIDRs, IAM principals, or state-backend locations —
every environment-specific value is a variable with no default.

**Audit everything, log no content.**
Every run should append an audit record (what was read, what was produced,
every refusal) keyed by hash and identity — never the extracted content
itself, which would otherwise create an unmanaged second copy of a licensed
or sensitive document.

## Known pain points

- PDF reading is the hardest reader: object streams (`/ObjStm`) are
  mandatory in PDF 1.5+ or the file reads as zero pages; `/ToUnicode` CMap
  parsing is not optional for subsetted fonts, or text decodes as garbage
  glyphs; the EOL before `endstream` must be trimmed when `/Length` is an
  indirect reference, or a valid deflate stream fails to decompress; text
  outside `BT`/`ET` blocks (e.g. `en-US` language tags) bleeds into output if
  not filtered.
- Word-spacing reconstruction from glyph coordinates has no exact answer —
  err toward inserting a space and repair short fragments afterward (e.g.
  `Cust+omer` → `Customer`), but never reconsider a confident space (`need to`
  must not become `needto`).
- A CLI argument parser using `i !== flagIndex + 1` silently drops the first
  positional argument when a flag is absent (`indexOf` returns `-1`, `-1 + 1`
  is `0`).
- Two refusal guards matter more than the parsing logic: almost-no-text for
  the page count means a scan (OCR needed, not a parse bug); >~40%
  single-character tokens means a subsetted font with no usable CMap.
- Confirmed while implementing the word-spacing repair above: a naive
  "rejoin a short fragment to the following lowercase word" regex applied
  to the *final* reconstructed line will happily eat real spaces too — "The
  form must be retained" became "Theform must beretained" because "The"
  and "be" are short words followed by a lowercase word, exactly like a
  genuine glyph-gap fragment. The fix is to mark only the spaces this
  reader *estimated* from a coordinate gap with a sentinel before running
  repair, and never touch a space that was already literally in the source
  string — the brief's "never reconsider a confident space" rule has to be
  enforced structurally, not by re-guessing from the output text.

## Note on the embedded build instructions

[`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md) also contains an instruction
telling an agent to append the content into `docs/BRIEF.md`,
`.github/copilot-instructions.md`, and `AGENTS.md`, then build and commit a
full application end to end. That instruction was **not** executed when this
file was added to this repository — this branch holds the reference spec
plus the demo scaffold only, not a built application.
