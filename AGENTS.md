# Working on the Spec-Ingest Tool

Scope: this branch (`Ingest`) only — `src/`, `cli.mjs`, `mcp.mjs`,
`ingestRunner.mjs`, `tsconfig.json`, and the `ui/` subpackage. The full
brief is [`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md); read the numbered
section a task references before changing the code that section governs.
`ui/` has its own [`ui/README.md`](ui/README.md) covering its narrower
"no path from a request, ever" and "escape everything document-derived"
rules — read that one too before touching the browser UI.

## Hard constraints

- Zero runtime dependencies. Only `devDependencies` in `package.json` — no
  PDF engine, ZIP library, YAML parser, or MCP SDK this package did not
  write and cannot audit. A grep of the lockfile for a model-provider SDK
  (`openai`, `@anthropic-ai/*`, etc.) is a build failure; see
  `test/noModelProviderSdk.test.ts`.
- No model, no model-provider SDK, no API key anywhere in this package.
  `--no-ml` is the default; if you touch `src/inference.ts`, the parity
  test in `test/noMlParity.test.ts` must still pass — every deterministic
  candidate present, byte-identical, whether or not inference is enabled.
- Claim a source by its content, never its file extension (see
  `ingestRunner.mjs`'s `sniffKind`/`sniffZipKind` — shared by `cli.mjs` and
  `ui/server.mjs` so the two shells can't disagree).
- Never write a credential, token, connection string, or private key into
  generated output, an audit record, or a commit — `codebaseReader.ts`'s
  `scrubCredentialShapedLines` and `journalSpec.ts`'s value-stripping are the
  pattern; match it in any new reader.
- Prove a reader against a real file, not only a synthetic fixture, before
  calling it done — every serious defect this scaffold's readers hit
  (`/ObjStm`, `/ToUnicode`, word-spacing) was found that way, not by a unit
  test. `README.md`'s "Known pain points" records the ones already found;
  add to it rather than re-discover one silently. This applies to CI/CD
  files too: `ci.yml` and `daily-health-check.yml` were both found
  silently broken by a branch-merge (a duplicate `on:` key discarding this
  branch's own trigger) — reading a workflow file, not just trusting a
  green run, is part of "proving it against the real thing."
- `ui/` never takes a filesystem path from a request — only a name checked
  against a directory listing the server just read itself — and every
  value derived from a document (a path, an error message, a
  contradiction's claim/ref) is HTML-escaped before it reaches a response.
  Both are load-bearing security properties, not style; don't relax
  either one to make a feature simpler.

## The loop

1. Read the brief section the task references (`grep -n "^## " Spec-Ingest-Tool.md`
   to find it) before writing code against it.
2. Implement, keeping `src/index.ts`'s barrel export in sync with any new
   module.
3. Write a real vitest test in `test/` — for a binary format reader, build
   the file's actual byte structure in the test rather than mocking the
   reader's internals (see `test/pdfText.test.ts`, `test/unzip.test.ts` for
   the pattern).
4. Run `npm run build && npm test` and fix everything before returning.
5. If the change is user-facing from the CLI, smoke-test it:
   `node cli.mjs <a real file>` and read the printed output — don't assume
   the unit tests caught everything a real run would show.
6. If the change touches `ingestRunner.mjs` or `ui/`, smoke-test the UI too
   — run it locally (`INGEST_DATA_DIR=./some-folder node ui/server.mjs`)
   or build and run the real image (`docker build -f ui/Dockerfile -t
   spec-ingest-ui .` then `docker run --rm -p 8787:8787 -v
   ./some-folder:/data spec-ingest-ui`) and request a real page — a change
   to the shared sniff loop can silently change both shells at once.

Never claim something works because it compiles. A generated reader is a
proposal until `npm run build`, `npm test`, and a real-file CLI run all
agree — the same rule this repo applies to everything it generates.
