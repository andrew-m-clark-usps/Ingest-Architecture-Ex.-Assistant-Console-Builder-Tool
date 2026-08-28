# Running-system capture (Spec-Ingest-Tool.md section 5E)

Separate from the core `spec-ingest-tool` package, which ships with **zero
runtime dependencies**. Playwright runs on Node at capture time only and
ships in nothing — see section 2/7A.

## Usage

```bash
npm install
# log in by hand once, save the session (never in the script or repo):
#   node -e "..." or use Playwright's codegen --save-storage=.auth/storageState.json
npm run capture -- https://staging.example.test out/ /change-of-address
```

Output: one `step-N/` directory per route, in the shape
`src/journalSpec.ts` (in the core package) already reads —
`meta.json`, `fields.json`, `ax-tree.json`, `styles.json` — plus
`network.json`, `console.json`, and `screenshot.png`.

## What it captures, per route

Accessibility snapshot, form structure, network (request/response
**structure only** — see below), console/page errors, computed styles, a
screenshot, and same-origin links to crawl next.

## Safety rules (enforced in `redact.mjs`, unit tested)

- **Never** records an `Authorization` header, a `Cookie`, or `Set-Cookie`
  — not even redacted.
- Every request/response body is reduced to its **structure** (keys,
  types, nullability) before it is written — never a value.
- The query string is dropped from every route; it carries session
  identifiers and record ids, not the route itself.
- Auth is a `storageState` file the caller logs into by hand and saves to
  a **gitignored** path (`.auth/storageState.json` by default, override
  with `SPEC_INGEST_STORAGE_STATE`). No credential is ever in the script.
- Capture against a test environment. Never production — the unhappy-path
  probes (empty submit, an over-length field) intentionally provoke
  validation errors.

## Known limitation — not independently browser-tested here

This sandboxed environment cannot download a Chromium binary
(`npx playwright install chromium` fails: the corporate proxy returns
403 for `cdn.playwright.dev`). The Playwright API calls in `capture.mjs`
are written against the documented API (`page.accessibility.snapshot()` —
not the brief's informally-named `page.accessibleSnapshot()`, a real
naming defect this repo's convention is to record rather than silently
paper over). The redaction/structure-stripping logic they depend on **is**
unit tested (`test/redact.test.ts`) since it has no browser dependency.
Run `npm run capture` yourself once Chromium is installed on a network
that can reach `cdn.playwright.dev` to confirm the live-browser path end
to end before relying on it.
