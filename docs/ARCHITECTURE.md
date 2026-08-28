# Architecture

This document describes how the three products in this repository relate,
and how each one works internally. It expands on the summary in the top-level
[`README.md`](../README.md).

## Repository layout

This repo carries three products, each developed on its own branch, plus an
integration view on `main` (this branch) where all three converge:

| Product | Home branch | Brief | Code |
|---|---|---|---|
| Spec-Ingest Tool | [`Ingest`](https://github.com/andrew-m-clark-usps/Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool/tree/Ingest) | [`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md) | `src/`, `cli.mjs`, `mcp.mjs` |
| Addressing Console | [`Console`](https://github.com/andrew-m-clark-usps/Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool/tree/Console) | [`Console.md`](Console.md) | `console-app/` |
| Assistant + Dashboard + Parity Harness | [`Exec-Assistant`](https://github.com/andrew-m-clark-usps/Ingest-Architecture-Ex.-Assistant-Console-Builder-Tool/tree/Exec-Assistant) | [`Exec-Assistant.md`](Exec-Assistant.md) | `assistant.py`, `dashboard/`, `tools/`, `console/` |

Each product branch is trimmed to hold only its own product's files and brief.
`main` is the integration branch and holds all three.

## How the three relate

```mermaid
flowchart TB
    SI["Spec-Ingest Tool<br/>(Ingest branch)<br/>reads specs &amp; old systems,<br/>produces a working application"]
    CO["Addressing Console<br/>(Console branch)<br/>a worked example of<br/>what the tool produces"]
    EA["Exec Assistant + Console Dashboard<br/>(Exec-Assistant branch)<br/>daily-driver assistant +<br/>operational dashboard"]
    TW["twinning.mjs<br/>(inside Exec-Assistant)<br/>parity harness"]

    SI -->|produces / rebuilds| CO
    SI -->|produces / rebuilds| EA
    TW -->|proves a rebuild of| CO
    TW -->|proves a rebuild of| EA
    EA -.->|ships the harness used by| TW
```

## Spec-Ingest pipeline (Ingest branch)

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

## Exec-Assistant engine flow (Exec-Assistant branch)

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

## Parity harness — twinning.mjs (Exec-Assistant branch)

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

## Addressing Console sections (Console branch)

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

Stated in every brief because they may be read out of order:

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

See [`../SECURITY.md`](../SECURITY.md) for the full security posture that
applies to anything built from these briefs.
