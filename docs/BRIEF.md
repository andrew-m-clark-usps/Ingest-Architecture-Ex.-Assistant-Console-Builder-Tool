# Build Brief — Reference Specifications

> **Status:** This repository currently holds **reference specifications and demo scaffolds only**, not built applications. The full brief content is preserved in the specification documents linked below.

## Overview

This repository is organized in three branches, each with its own specification document:

1. **`Ingest` branch** — [Spec-Ingest-Tool.md](Spec-Ingest-Tool.md)
   - The specification tool that builds the other two
   - Readers: `.pptx`, PDF, spreadsheet, OpenAPI, existing codebase, images/OCR, recorded sessions
   - Outputs: working application with tests, CI, and Terraform

2. **`Console` branch** — [Console.md](Console.md)
   - Business Customer Gateway console
   - Address validation, payment ledgers, usage metering
   - Browser-only, no backend, no credentials

3. **`Exec-Assistant` branch** — [Exec-Assistant.md](Exec-Assistant.md)
   - Commitments assistant and operational dashboard
   - Parity harness for proving rebuild behavior
   - Static site, no JavaScript in rendered pages

## What to Read

Each specification document contains:
- **Hard constraints** and design rules
- **Stack and version pins**
- **Domain rules and workflows**
- **Done means** (acceptance criteria)
- **Reference material and URLs**

All three briefs share common invariants:
- **No JavaScript** in any rendered page (no script tags, style attributes, or on* handlers)
- **Dark theme only** — one theme, no light variant
- **No AI model or SDK** in shipped product
- **Untrusted input handling** — everything extracted is quoted content
- **Provenance tracking** — every figure, rule, and field traces to a source

## Current Status

Each branch holds:
- ✅ Full specification document (reference only)
- ✅ Demo/reference scaffold (minimal, incomplete)
- ❌ Built application (not implemented)

The three branches converge periodically on `main` for integration testing.

## Next Steps

To build a full application:
1. Choose a branch (`Ingest`, `Console`, or `Exec-Assistant`)
2. Read the corresponding specification document in full
3. Follow the "Step 2" build instructions in that document
4. Commit changes as you go
5. Run build/test commands before opening a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for ground rules on working with this codebase.

## Related Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — Ground rules and workflow
- [ARCHITECTURE.md](ARCHITECTURE.md) — How the three parts relate
- [Spec-Ingest-Tool.md](Spec-Ingest-Tool.md) — Full specification for the Spec-Ingest tool
- [Console.md](Console.md) — Full specification for the Console
- [Exec-Assistant.md](Exec-Assistant.md) — Full specification for the Commitments Assistant
