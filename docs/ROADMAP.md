# Roadmap

This is a feature timeline for closing the gap between each branch's current
demo/reference scaffold and the "done means" acceptance criteria in its
brief. There are no fixed calendar dates — this is a demo repository, not a
production system with committed delivery dates — so work is sequenced into
phases instead. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how the three
products relate, and [`../.github/workflows/daily-health-check.yml`](../.github/workflows/daily-health-check.yml)
for the automated status check that tracks build/test/audit health as this
roadmap is worked.

Each product branch (`Ingest`, `Console`, `Exec-Assistant`) should pull items
from its own section below. `main` picks up the finished work as each branch
converges back in.

## Spec-Ingest Tool (`Ingest` branch)

**Current state:** CLI/MCP entry points and `tsconfig`/build/test wiring
exist; most reader/corpus/profile logic in `src/*.ts` is a stub pointing back
at [`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md) section 14 (Done Means).

- **Phase 1 — real single-format readers.** Implement the PDF reader
  (object-stream support, `/ToUnicode` CMap decoding, EOL trimming before
  `endstream`) and the PPTX reader, and prove each against a real file, not
  only synthetic fixtures — every serious defect the brief documents was
  found that way.
- **Phase 2 — corpus assembly.** Candidate merge/dedupe, contradiction
  detection (tested on sources that genuinely disagree *and* sources that
  agree), and the garbled-output/low-signal refusal guards.
- **Phase 3 — profile inference and generation.** Profile scoring against a
  corpus, the generic-profile-has-no-domain-vocabulary guard, and generating
  a real repository (app + tests + CI + Terraform) that installs, builds,
  and runs — not just exists as files.
- **Phase 4 — capture + parity inputs.** The running-system reader producing
  an inventory a test can read, with an explicit check that no captured
  artifact contains an Authorization header, cookie, or request body value.
- **Phase 5 — inference guardrails.** `--no-ml` vs. model-enabled parity
  test (every deterministic candidate byte-identical either way); the
  no-model-provider-SDK-in-lockfile grep test.
- **Phase 6 — image/OCR reader and design-token extraction**, per sections
  covering transcription-not-interpretation and literal-value-free CSS.

## Addressing Console (`Console` branch)

**Current state:** `console-app/` has full routing/theme/layout wiring; each
page under `src/pages/` is a placeholder `Typography` stub citing its
[`Console.md`](Console.md) section.

- **Phase 1 — domain core before UI**, per the brief's own advice: build and
  unit-test the BCG access model, ledger aggregation, and usage-metering
  logic first, and look at the *rendered* result before trusting a passing
  test — the worst bugs in the original build were aggregation errors every
  unit test passed.
- **Phase 2 — Gateway, Ledger, Usage pages.** Wire the domain core into the
  three financial/reporting pages; implement the balance-over-time and
  closing-balance aggregations exactly as specified (total position per
  date, sum of per-account closing balances) to avoid the two known
  aggregation bugs.
- **Phase 3 — Validator + Change-of-address workbench.**
- **Phase 4 — Reports, Data Sources, PAF/licensing, Reference pages**, using
  the verified external URL list in section 8 (re-checked by a script that
  exits non-zero on a broken link).
- **Phase 5 — quality gates.** `npm run lint` clean under flat config;
  `npm run smoke` (Playwright) across grids/exports/access model/metering/
  theme toggle with zero console errors; a grep of `dist/` for `type=
  "password"`, `fetch(`, `XMLHttpRequest`, and any AI SDK, all absent.
- **Phase 6 — MCP tool parity check**: assert the MCP return-code lookup and
  the standardizer agree with the UI.

## Assistant + Dashboard + Parity Harness (`Exec-Assistant` branch)

**Current state:** `assistant.py`'s `init`/`capture`/`file`/`brief`/`site`
commands are real and tested (4/4 unit tests passing); `eod`/`week`/most of
section 6 are stubs. `tools/twinning.mjs` and `console/DashboardCore.tsx`
are verbatim from the brief's appendices.

- **Phase 1 — close out the CLI dispatch.** Implement `eod` (sweep closures,
  roll overdue with `count++` and the date never moving) and `week`
  (`weekly.md`), matching every command in brief section 6 to `assistant.py`'s
  dispatch — a requirement enforced later by `spec_check.py`.
- **Phase 2 — contrast + spec-check tooling.** `tools/contrast.py` (4.5:1 for
  signal colours, 3:1 for `rule-strong`, `rule` itself not checked) and
  `tools/spec_check.py` verifying every brief claim against the code.
- **Phase 3 — dashboard build-out.** `dashboard/` beyond the current
  `dashboard.py`/`rbac.md`/`sample.json` stubs, still no-script/dark-only.
- **Phase 4 — parity harness in CI.** Get `.github/workflows/twinning.yml`
  green on a first push, with the artifact-upload step correctly gated
  (`if: failure()` + `if-no-files-found: ignore`) so a passing run never
  fails on upload.
- **Phase 5 — spec-ingest integration inputs** for this branch's own
  content: PPTX/PDF/XLSX reading, contradiction detection, and the
  four-stories no-argument run producing a working application with
  inference shown beside its source sentence.
- **Phase 6 — guardrail tests.** No-model-provider-SDK grep; stdlib-only
  import check outside `tools/`; no `<script>`/`on*`/`<style>` in rendered
  output.

## Cross-cutting (all branches)

- Keep [`../.github/workflows/daily-health-check.yml`](../.github/workflows/daily-health-check.yml)
  green — it runs build/test/`npm audit` daily and opens or updates a
  tracking issue on failure or new vulnerabilities. It never writes code; it
  only reports status, so roadmap work stays human-reviewed.
- Re-run `npm audit` (and Python equivalents, where applicable) after any
  dependency bump made while working a roadmap item, per
  [`CONTRIBUTING.md`](CONTRIBUTING.md).
