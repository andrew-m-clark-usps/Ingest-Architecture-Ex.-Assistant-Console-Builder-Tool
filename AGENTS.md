# Working on the Assistant, Dashboard, and Parity Harness

Scope: this branch (`Exec-Assistant`) — `assistant.py`, `features.py`,
`ingest.py`, `mcp_server.py`, `dashboard/`, `tools/`, `console/`. The full
brief is [`Exec-Assistant.md`](Exec-Assistant.md); read the numbered section
a task references before changing the code that section governs.
`console/` has its own [`console/AGENTS.md`](console/AGENTS.md) — read that
one instead if the task is scoped there.

## Hard constraints

- Python standard library only outside `tools/` and `console/` —
  `assistant.py`/`features.py`/`ingest.py`/`mcp_server.py`/`dashboard/`
  take no pip install. `tools/` and `console/` are separate npm packages
  and may use what they need (Playwright, the MCP SDK, React) — see each
  one's own `package.json`.
- No `<script>` tag, `on*` attribute, `<style>` block, or `style` attribute
  in any rendered page except the React console in `console/` (the one
  named exception, a separate product with its own build).
- Match on word boundaries (`\bverb\b`), never a substring, when
  classifying a line as a task — `ask` sits inside `task`/`asks`, and a
  substring check misclassifies "the task list is long" as a task. See
  `test_core.py`'s `test_word_boundary_not_substring`.
- A roll increments the count and never moves the date; `read_session`
  must skip the `<!--summary-->` region `summarize` writes, or a decision
  appears twice in meeting prep.
- `:target`-driven pages need `scroll-margin-top` on panels and a sticky
  tab bar, or navigating a tab scrolls it off-screen. CSS load order
  matters: `widgets.css` loads last and wins ties with `topnav.css` at
  equal specificity — put a mobile override where it will actually apply.

## The loop

1. Read the brief section the task references
   (`grep -n "^## " Exec-Assistant.md`).
2. Implement against `assistant.py`'s existing dispatch pattern for a new
   CLI command, or the corresponding stub module for anything else.
3. Add a `unittest` case to `test_core.py` for classification/date logic —
   the word-boundary and date-resolution tests are the pattern to follow.
4. Run `python -m unittest test_core -v`; fix everything before returning.
5. If the change touches `tools/twinning.mjs`, remember the six defects the
   brief's own circulating sample had (`node-version` not `node-size`;
   never run the MCP server as a CI step; no silent fallback that makes a
   broken page compare as passing; a real screenshot directory; `if:
   failure()` + `if-no-files-found: ignore` on the artifact upload) before
   trusting a green run.

Never claim something works because it parses. A generated command is a
proposal until `python -m unittest test_core` passes and, for anything
CI-facing, the workflow has actually gone green on a real push — the same
rule this repo applies to everything it generates.
