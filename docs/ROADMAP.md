# Roadmap

This is a feature timeline for closing the remaining gap between each
product's implemented state and the "done means" acceptance criteria in its
brief. Much of the original scaffold work on `main` is already complete and
validated; the notes below now distinguish finished phases from the later
inputs and readers that still remain. There are no fixed calendar dates — this
is a demo repository, not a production system with committed delivery dates —
so work is sequenced into phases instead. See [`ARCHITECTURE.md`](ARCHITECTURE.md)
for how the three products relate, and
[`../.github/workflows/daily-health-check.yml`](../.github/workflows/daily-health-check.yml)
for the automated status check that tracks build/test/audit health as this
roadmap is worked.

Each product branch (`Ingest`, `Console`, `Exec-Assistant`) should pull items
from its own section below. `main` picks up the finished work as each branch
converges back in.

## Spec-Ingest Tool (`Ingest` branch)

**Current state:** CLI/MCP entry points, PDF/PPTX readers, corpus merge and
contradiction detection, credential/refusal guards, profile scoring, recorded
session ingestion, the `--no-ml` and no-provider-SDK guardrails, and the
repository generator (`--generate`) are implemented and validated on `main`.
The remaining gap is concentrated in additional source readers and broader
capture inputs, not in the original reader/corpus/generator skeleton.

- **Phase 1 — real single-format readers.** Complete on `main`: the PDF reader
  (object-stream support, `/ToUnicode` CMap decoding, EOL trimming before
  `endstream`) and the PPTX reader, and prove each against a real file, not
  only synthetic fixtures — every serious defect the brief documents was
  found that way.
- **Phase 2 — corpus assembly.** Complete on `main`: candidate merge/dedupe, contradiction
  detection (tested on sources that genuinely disagree *and* sources that
  agree), and the garbled-output/low-signal refusal guards.
- **Phase 3 — profile inference and generation.** Complete on `main`: profile scoring against a
  corpus, the generic-profile-has-no-domain-vocabulary guard, and generating
  a real repository (app + tests + CI + Terraform) that installs, builds,
  and runs — not just exists as files.
- **Phase 4 — capture + parity inputs.** Partially complete on `main`: the recorded-session reader consumes `meta.json`, `fields.json`, `ax-tree.json`, and `styles.json`, strips query strings from routes, and tolerates malformed artifacts. Remaining work is the broader running-system inventory flow and the explicit test proving no captured artifact contains an Authorization header, cookie, or request-body value.
- **Phase 5 — inference guardrails.** Complete on `main`: `--no-ml` vs. model-enabled parity
  test (every deterministic candidate byte-identical either way); the
  no-model-provider-SDK-in-lockfile grep test.
- **Phase 6 — image/OCR reader and design-token extraction.** Partially complete on `main`: design-token extraction exists for recorded sessions (`styles.json` input), and the PDF reader explicitly detects scanned-document/OCR-needed cases. Remaining work is a true image/OCR reader and the broader extraction path described in the brief.

##  Console (`Console` branch)

**Current state:** `console-app/` is implemented as a browser-only React/MUI
console with real routing, theme/layout wiring, domain-core libraries, all
page modules, reporting/data-source/reference flows, `check:dist`,
`check:links`, Playwright smoke coverage, and MCP parity tests. The original
placeholder-page state no longer applies on `main`.

- **Phase 1 — domain core before UI.** Complete on `main`, per the brief's own advice: build and
  unit-test the BCG access model, ledger aggregation, and usage-metering
  logic first, and look at the *rendered* result before trusting a passing
  test — the worst bugs in the original build were aggregation errors every
  unit test passed.
- **Phase 2 — Gateway, Ledger, Usage pages.** Complete on `main`: wire the domain core into the
  three financial/reporting pages; implement the balance-over-time and
  closing-balance aggregations exactly as specified (total position per
  date, sum of per-account closing balances) to avoid the two known
  aggregation bugs.
- **Phase 3 — Validator + workbench.** Complete on `main`.
- **Phase 4 — Reports, Data Sources, PAF, and Reference pages.** Complete on `main`, using
  the verified external URL list in section 8 (re-checked by a script that
  exits non-zero on a broken link).
- **Phase 5 — quality gates.** Complete on `main`: `npm run lint` clean under flat config;
  `npm run smoke` (Playwright) across grids/exports/access model/metering/
  theme toggle with zero console errors; a grep of `dist/` for `type=
  "password"`, `fetch(`, `XMLHttpRequest`, and any AI SDK, all absent.
- **Phase 6 — MCP tool parity check.** Complete on `main`: assert the MCP and
  the standardizer agree with the UI.

## Assistant + Dashboard + Parity Harness (`Exec-Assistant` branch)

**Current state:** `assistant.py` implements the full section 6 command
dispatch checked by `tools/spec_check.py`; `eod`, `week`, `prep`, `remind`,
and the other CLI paths are covered by the current unit suite; the contrast,
spec-check, and guardrail tools are implemented; and `dashboard/dashboard.py`
builds the static dark-only dashboard pages. Remaining work is concentrated in
the later spec-ingest integration inputs and any deeper dashboard expansion
beyond the current static-site build.

- **Phase 1 — close out the CLI dispatch.** Complete on `main`: implement `eod` (sweep closures,
  roll overdue with `count++` and the date never moving) and `week`
  (`weekly.md`), matching every command in brief section 6 to `assistant.py`'s
  dispatch — a requirement enforced later by `spec_check.py`.
- **Phase 2 — contrast + spec-check tooling.** Complete on `main`: `tools/contrast.py` (4.5:1 for
  signal colours, 3:1 for `rule-strong`, `rule` itself not checked) and
  `tools/spec_check.py` verifying every brief claim against the code.
- **Phase 3 — dashboard build-out.** Partially complete on `main`: `dashboard/dashboard.py` builds multiple static dark-only pages from `dashboard/sample.json`. Remaining work is any richer dashboard expansion beyond the current no-script static-site output.
- **Phase 4 — parity harness in CI.** Largely complete on `main`: [`.github/workflows/twinning.yml`](../.github/workflows/twinning.yml) is wired with the artifact-upload gate (`if: failure()` + `if-no-files-found: ignore`). The remaining proof point is a real remote CI run, not local code scaffolding.
- **Phase 5 — spec-ingest integration inputs** for this branch's own
  content: PPTX/PDF/XLSX reading, contradiction detection, and the
  four-stories no-argument run producing a working application with
  inference shown beside its source sentence.
- **Phase 6 — guardrail tests.** Complete on `main`: no-model-provider-SDK grep; stdlib-only
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
