# Working on the Spec-Ingest Tool

Scope: this branch (`Ingest`) only — `src/`, `cli.mjs`, `mcp.mjs`,
`tsconfig.json`. The full brief is [`Spec-Ingest-Tool.md`](Spec-Ingest-Tool.md);
read the numbered section a task references before changing the code that
section governs.

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
- Claim a source by its content, never its file extension (see `cli.mjs`'s
  `sniffKind`/`sniffZipKind`).
- Never write a credential, token, connection string, or private key into
  generated output, an audit record, or a commit — `codebaseReader.ts`'s
  `scrubCredentialShapedLines` and `journalSpec.ts`'s value-stripping are the
  pattern; match it in any new reader.
- Prove a reader against a real file, not only a synthetic fixture, before
  calling it done — every serious defect this scaffold's readers hit
  (`/ObjStm`, `/ToUnicode`, word-spacing) was found that way, not by a unit
  test. `README.md`'s "Known pain points" records the ones already found;
  add to it rather than re-discover one silently.

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

Never claim something works because it compiles. A generated reader is a
proposal until `npm run build`, `npm test`, and a real-file CLI run all
agree — the same rule this repo applies to everything it generates.
