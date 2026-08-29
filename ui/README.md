# Spec-Ingest UI

A lightweight browser front end for the Spec-Ingest Tool — the "full-stack
service" delivery shape from [`../Spec-Ingest-Tool.md`](../Spec-Ingest-Tool.md)
section 1A, scoped down to its simplest useful form: mount a directory,
open a page, click a file, read the same report `node cli.mjs` prints.

Zero runtime dependencies — `node:http`, `node:fs`, `node:path`, `node:url`
only. It is a separate subpackage (its own `package.json`), the same
pattern as [`../capture/`](../capture/) and [`../ocr/`](../ocr/), so the
core library under `../src/` keeps its zero-runtime-dependency invariant
regardless of what this shell needs.

## What it is not

- Not a file-upload service. It lists whatever is mounted at a directory
  (`INGEST_DATA_DIR`, `/data` in the Docker image) and lets you pick from
  that list — no multipart parser to get wrong, no arbitrary path ever
  taken from a request (see "Security" below).
- Not a build step, not a framework, no client-side JavaScript, no
  bundler. Every page is server-rendered HTML; the one stylesheet
  (`style.css`) is served as its own response so no page needs a
  `<style>` block or attribute, per the no-JavaScript-in-rendered-pages
  invariant stated in the brief and `../README.md`.

## Run it

**With Docker** (build from the repo root so the image can reach `../src`
and `../ingestRunner.mjs`):

```bash
docker build -f ui/Dockerfile -t spec-ingest-ui .
docker run --rm -p 8787:8787 -v /path/to/your/files:/data spec-ingest-ui
```

Open <http://localhost:8787>. Drop `.pdf`/`.pptx`/`.xlsx`/OpenAPI
`.json`/`.yaml` files or a codebase directory into the mounted folder,
reload, and click "run" — or check several and click "Run selected", or
"Run all" to ingest everything in the directory in one pass.

**Without Docker**, from the repo root (after `npm install && npm run build`
so `dist/index.js` exists):

```bash
INGEST_DATA_DIR=./some-folder node ui/server.mjs
```

## Security

- **Server-authoritative file listing.** A request never supplies a
  filesystem path — only a *name*, checked for exact membership in a
  listing this process just read from `INGEST_DATA_DIR` itself. There is
  no path-traversal surface: a name containing `/`, `\`, or `..` is
  rejected outright, and names that no longer match a fresh directory
  listing are silently dropped rather than opened.
- **Every value derived from a document is HTML-escaped** before it is
  written into a response — a file path, an error message, a
  contradiction's claim or reference. A document is untrusted input (see
  `../README.md`'s "Security" section); this UI is the first place in
  this scaffold that renders that content into an actual browser, so it is
  the one place an unescaped value could execute as markup or script.
- **Body size capped** at 64 KiB for the "run selected" form post — this
  page only ever posts a handful of checkbox names.
- Reads only; nothing here writes a file, calls out to a network, or
  reaches a model.
