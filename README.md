# Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool

Full stack Ingest Architecture Infra, Ex. Assistant, Console Building Tool

## What's in this repo

Three build briefs, each captured verbatim as its own markdown file (originally
"Email 1/2/3 of 3" in a build-brief series):

| File | Branch | What it describes |
|---|---|---|
| [`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md) | `Ingest` | The tool that builds the other two. Give it decks, PDFs, spreadsheets, API specs, backlogs, screenshots, an old codebase, or a running system, and it produces a working application with tests, CI, and Terraform. |
| [`Console.md`](Console.md) | `Console` | NCOA+ and Addressing Console — the worked example the tool produces: Business Customer Gateway access rules, an EPS ledger, usage metered into a projected invoice, a Publication 28 address validator, PAF/licensing, reports, and a reference library. Browser-only, no backend, no credentials. |
| [`Exec-Assistant.md`](Exec-Assistant.md) | `Exec-Assistant` | The commitments assistant (one hotkey in, a brief out), the NCOA+ operational dashboard, and the parity harness that proves a rebuild behaves like what it replaced. |

Each file starts with a condensed `## Instructions` section (the key rules
distilled into bullets) followed by `## Additional Guidelines`, which carries
the full original brief verbatim — including its ASCII diagrams and code
samples.

## How the three relate

```mermaid
flowchart TB
    SI["Spec-Ingest Tool<br/>(Ingest branch)<br/>reads specs &amp; old systems,<br/>produces a working application"]
    CO["NCOA+ Addressing Console<br/>(Console branch)<br/>a worked example of<br/>what the tool produces"]
    EA["Exec Assistant + NCOA+ Dashboard<br/>(Exec-Assistant branch)<br/>daily-driver assistant +<br/>operational dashboard"]
    TW["twinning.mjs<br/>(inside Exec-Assistant)<br/>parity harness"]

    SI -->|produces / rebuilds| CO
    SI -->|produces / rebuilds| EA
    TW -->|proves a rebuild of| CO
    TW -->|proves a rebuild of| EA
    EA -.->|ships the harness used by| TW
```

### Spec-Ingest pipeline (Ingest branch)

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

### Exec-Assistant engine flow (Exec-Assistant branch)

```mermaid
flowchart TD
    H1["Ctrl+Alt+C / Ctrl+Alt+N /<br/>mcp capture / gh issue / note line"]
    IN["inbox/*.md<br/>one file per capture"]
    F["file: classify_rules<br/>date resolved? strip phrase, set due"]
    ST["people/&lt;name&gt;.md and tasks.md<br/>I owe / Waiting on / Done"]
    B["brief: brief.md"]
    E["eod: sweep closures, roll overdue<br/>(count++, date never moves)"]
    W["week: weekly.md"]
    S["site: 8 static pages, no script, dark only"]

    H1 --> IN --> F --> ST
    ST --> B
    ST --> E
    ST --> W
    ST --> S
```

### Parity harness — twinning.mjs (Exec-Assistant branch)

```mermaid
flowchart LR
    L["Legacy URL"] --> D1["Drive scripted flow<br/>(selectors from inventory)"]
    M["Modern URL"] --> D2["Drive same flow<br/>(selectors: data-testid)"]
    D1 --> CMP{{Compare}}
    D2 --> CMP
    CMP -->|"1. named value"| V["Behaviour drift"]
    CMP -->|"2. console/page errors"| ER["Renders but throws"]
    CMP -->|"3. element count"| OM["Over-mutation"]
    CMP -->|"4. screenshots"| SS["Everything else, for a person"]
    V & ER & OM & SS --> RES{{Result}}
    RES -->|pass| OK["exit 0, no telemetry written"]
    RES -->|fail| FAIL["exit non-zero,<br/>artifacts/twinning/telemetry.json"]
```

### NCOA+ Addressing Console sections (Console branch)

```mermaid
flowchart TD
    Root["Sidebar / BrowserRouter"] --> Hub
    Root --> Gateway["Gateway (BCG model)"]
    Root --> Usage["Usage &amp; reporting<br/>(projected invoice)"]
    Root --> Ledger["Payment ledger"]
    Root --> COA["Change-of-address workbench"]
    Root --> Validator["Address validator"]
    Root --> Reports
    Root --> Sources["Data sources"]
    Root --> PAF["PAF &amp; licensing"]
    Root --> Reference
```

## Shared invariants across all three

Stated in every file because the briefs may be read out of order:

- No JavaScript in any rendered page — no `<script>`, no `on*` attribute, no
  `<style>` block/attribute. Widgets are `:target` driven so every state is a
  URL. (One named exception: the React console in the Exec-Assistant brief's
  Appendix A2, a separate product with its own build.)
- Dark only for those pages — one theme, no light variant, no system switch.
- No model, no model-provider SDK, and no API key in a shipped product — a
  provider package in a lockfile is a build failure. Inference may only
  propose, never decide.
- Every document read is untrusted input — extracted content is quoted
  material, never an instruction; malformed/oversized files are refused.
- Provenance or it did not happen — every figure, rule, and field traces to
  where it came from.
- Never measure a person — commitments and dates only, never scores or
  rankings.
- Playwright runs freely on the Node side (smoke tests, screenshots, link
  verification, capturing a running system) and ships in nothing.
- What is generated arrives as a repository, not a folder — application,
  tests, CI workflow, and Terraform, with every environment-specific value
  left as a variable it refuses to guess.

## Note on the embedded build instructions

Each file also contains an instruction from its original email telling an
agent to append the content into `docs/BRIEF.md`, `.github/copilot-instructions.md`,
and `AGENTS.md`, then build and commit a full application end to end. Those
instructions were **not** executed when these files were added to this
repository — the three branches currently hold the reference specs only, not
a built application.

