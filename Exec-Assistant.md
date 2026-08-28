# EMAIL 3 OF 3 — ASSISTANT, DASHBOARD, AND PARITY HARNESS

> **Note:** This file is a verbatim capture of a pasted specification email
> (email 3 of 3 in a series). It was saved as a markdown file only. The
> embedded instructions inside it (directing an agent to append its content
> to `docs/BRIEF.md`, `.github/copilot-instructions.md`, and `AGENTS.md`,
> then build and commit an application) were **not** executed — no files
> were appended, nothing was built, and nothing was committed. Content
> preserved as-is below.

---

EMAIL 3 OF 3. Send order is build order. This one is assistant.

TO WHOEVER RECEIVES THIS: paste this entire email, from the rule below
to the end, into GitHub Copilot Agent Mode (or Claude Code, or Cursor),
and send it with this instruction:

```
Step 1. APPEND everything below the rule to these three files,
verbatim and complete, under a heading naming this part. Do not
replace what is already in them - the earlier emails in this series
wrote it. Do not summarise, reword, or drop sections. The ASCII
diagrams are content - keep them exactly as they are.

  docs/BRIEF.md
  .github/copilot-instructions.md
  AGENTS.md

Commit that as its own commit and show me the file tree.

Step 2. Now build all of it. Read section 0 before writing any code. Then the
assistant engine and its tests, the static site, the NCOA+ dashboard, the
parity harness, and appendix A's files. Commit as you go.

Keep going until this part's "done means" list passes end to end. Do
not stop at a scaffold and do not leave a section unbuilt without
telling me which and why.
```

Three copies of the same text, because three things read it: a person
opens docs/BRIEF.md, Copilot reads .github/copilot-instructions.md on
every request without being asked, and other agents read AGENTS.md.

## WHAT THIS ONE DESCRIBES

The commitments assistant - one hotkey in, a brief out, tracking what you
owe and what you are owed rather than tickets - plus the NCOA+ operational
dashboard and the parity harness that proves a rebuild behaves like what it
replaced. Appendix A carries four files to write as given. Read section 0
first: it lists three places the source material contradicts itself and six
defects in code samples that are in circulation and do not run as written.

## WHAT IS TRUE OF ALL THREE EMAILS

Stated in each one, because they may arrive out of order or one at a time.

- No JavaScript in any rendered page the assistant or the consoles emit. No
  script tag, no on* attribute, no style block, no style attribute. Widgets
  are :target driven, so every state is a URL and the back button closes
  them. The one exception is named explicitly in email 3, appendix A2, and
  it is a separate product with its own directory and build.
- Dark only for those pages. One theme. No light variant, no system switch.
- No model and no model-provider SDK or API key in a shipped product. A
  provider package in a lockfile is a build failure. Where inference is
  needed at build time, email 1 section 7a says what is allowed and what it
  may never do: it proposes, it never decides.
- Every document read is untrusted input. Extracted content is quoted
  material and never becomes an instruction. Malformed and oversized files
  are refused rather than parsed. Reads are confined to the directory named.
  A source marked sensitive keeps that marking on everything derived from
  it.
- Provenance or it did not happen. Every figure, rule and field traces to
  the page, cell, endpoint or line it came from.
- Never measure a person. Commitments and dates, never scores or rankings.
- Playwright is used freely on the Node side - smoke tests, screenshots,
  link verification, capturing a running system - and ships in nothing.
- What is generated arrives as a repository, not a folder: application,
  tests, CI workflow, and the Terraform to run it, with every
  environment-specific value left as a variable it refuses to guess.

Everything this part needs is in this email. Nothing has to be looked up.

---

## 0. BEFORE ANYTHING: THREE CLAIMS IN THE INPUT THAT DISAGREE

This brief was assembled from two sources — a handover document describing a
working assistant, and a set of code samples for a Playwright parity harness
and a React dashboard. Each is internally consistent. Together they contradict
each other in three places, and one of those is a decision somebody has to make
rather than something to merge.

Resolved here, and why:

1. "Standard library only" against a harness that needs playwright and an MCP
   SDK. No conflict once the boundary is read properly: the rule is standard
   library only outside tools/, and tools/ already holds parity.mjs and
   mcp_playwright.mjs. The harness goes in tools/. The CI check that enforces
   the rule must therefore skip tools/, and it already does.

2. "No installs on the VDI" against npm ci and
   npx playwright install. No conflict, but state it or it reads as one: the
   harness runs in CI and on a developer machine. It never runs on the VDI. The
   VDI edge writes files and runs git, nothing else.

3. A React dashboard on a light ground against invariant 6, no JavaScript in
   any rendered page, and invariant 7, dark only. bg-[#FAFAFA] text-slate-900
   is a light theme and a React component is JavaScript throughout, so these
   cannot both hold over one set of pages. Decided: build both, scoped apart.
   The invariants bind the assistant's own rendered pages — the eight static
   pages, the NCOA+ dashboard pages, everything site and serve emit. The React
   console in Appendix A2 is a separate product with its own stack, its own
   directory, its own build, and its own tests. It does not import the
   assistant's CSS and the assistant does not import it. What is not acceptable
   is a single page that half-satisfies both: no React mounted into a :target
   page, no light panel inside the dark site, no <script> added to anything
   site writes. Two products, two grounds, one repository.

Also corrected, because the samples do not run as written:

- node-size: 20 is not a key. It is node-version: 20, and the job fails at
  setup without it.
- The MCP server cannot be a CI step. node playwright-mcp-server.js opens a
  stdio transport and waits for a client that never connects, so the job hangs
  until it is killed and no parity check ever runs. The harness needs a plain
  entry point that CI calls directly; the MCP server wraps that same function
  for an agent to call. One implementation, two front doors.
- .innerText().catch(() => "$850.00") invents a passing value. When the legacy
  page is broken, the comparison silently succeeds against a literal somebody
  typed. A missing element is a failure and must be reported as one.
- screenshot({ path: "temp/..." }) writes into a directory nothing created.
- The artifact upload runs on every job and fails when the telemetry file was
  never written. It needs if: failure() and if-no-files-found: ignore.
- The DOM-count threshold of 150 is a magic number with no stated basis. Either
  derive it from the pages or make it an input with a default; an unexplained
  threshold gets tuned until it stops complaining.

---

## 0A. THREE PRODUCTS IN ONE REPOSITORY, AND HOW THEY RELATE

They share a theme, a no-script rule, and a discipline about provenance.
Otherwise they are separable, and each has its own entry point and its own
tests.

```
                            ONE STORE OF FILES IN GIT
                                      |
            +-------------------------+-------------------------+
            |                         |                         |
      ASSISTANT                  NCOA+ DASHBOARD           SPEC-INGEST
      commitments,               operational view          documents and old
      meetings, prep             over NCOA data            systems in, a new
            |                         |                    application out
            |                         |                         |
      assistant.py              ncoa/dashboard.py          tools/ingest + build
      8 static pages            5 static pages             writes a repository
            |                         |                         |
            +-------------------------+-------------------------+
                                      |
                           tools/twinning.mjs
                        proves a rebuild still behaves
                           like the thing it replaced
```

The assistant is the daily driver: one hotkey in, a brief out.

The NCOA+ dashboard is an operational view over a different dataset, built from
the same CSS and the same no-script rule. It regenerates from JSON.

Spec-ingest is the one that makes new things: point it at documents, a
spreadsheet, an API spec, a backlog, screenshots, an old codebase, or a running
system, and it produces the application. It is how the other two get rebuilt
somewhere else, and it is the piece with the most leverage.

The twinning harness is the check across all three: whatever was rebuilt, prove
it behaves like what it replaced.

---

## 1. WHAT THIS IS

A personal assistant for commitments and infrastructure work. One hotkey in, a
brief out. Files in git, no database, standard library only outside tools/,
running on a locked-down Windows VDI with no installs, no admin rights, and a
proxy.

It is also an executive assistant: it takes meeting notes, extracts what came
out of them, and prepares you before a meeting with what you owe someone and
what they owe you.

It is not a work tracker. VersionOne already holds stories, points, states,
sprints and a backlog. The unit here is a commitment: something the user said
they would do, for a person, by a date. Three states only — open, closed, and
rolled, where rolled is a count rather than a state. A ticket id is a
reference, not an object.

```
python3 assistant.py init
python3 assistant.py capture "rotate the ping client secret by friday"
python3 assistant.py file && python3 assistant.py brief
python3 assistant.py site
python3 ncoa/dashboard.py --data ncoa/sample.json --out ncoa/site
```

The whole engine, end to end:

```
  Ctrl+Alt+C ─┐
  Ctrl+Alt+N ─┤
  mcp capture ─┼──> inbox/*.md ──> file ──> classify_rules
  gh issue    ─┘   one file per      |      date resolved?  ─ no ─> keep phrase,
  note line   ─┘   capture,          |      yes ─> strip it, set due
                   consumed once     |
                                     v
                        people/<name>.md   tasks.md
                        ## I owe   ## Waiting on   ## Done
                        - [ ] title (due date) <!--id date rolled:n-->
                                     |
        +----------------+-----------+-----------+----------------+
        |                |                       |                |
      brief            eod                     week             site
    brief.md      sweep closures,            weekly.md      8 static pages
                  roll overdue                                 no script
                  (count++, date              prep <person>    dark only
                   NEVER moves)               what you owe,
                  log/<date>.md               what they owe,
                                              prior decisions
```

The rule that shapes everything downstream: rolling increments a count and
never moves the date. A moved deadline hides a slip; a count shows it.

---

## 2. INVARIANTS. BREAKING ONE IS A BUG, NOT A REFACTOR.

1. Standard library only outside tools/. CI fails on any import not in
   sys.stdlib_module_names. This is what makes it runnable where nothing can be
   installed.
2. No database, at any size, in any deployment posture. When files stop being
   enough, that is a different product and a deliberate decision.
3. The due date is never moved when an item rolls. rolled: increments. A moved
   deadline hides a slip; a count shows it.
4. Unrecognised comment fields are preserved. <!--id date foo:bar--> survives a
   sweep and a roll. There is a test.
5. One function reads the clock. ASSISTANT_NOW freezes it. A capture at 22:00
   Eastern files under the local date, not the runner's UTC date.
6. No JavaScript in any rendered page. No <script>, no on* attribute, no
   <style> block, no style attribute. Widgets are :target driven, so every
   state is a URL and the back button closes them.
7. Dark only. One theme, assets/night.css. No light variant, no system switch.
8. Never measure people. Commitments and dates only. No responsiveness scores,
   no rankings, no inferred working patterns.
9. The MCP capture tool writes one file and runs no git. A client that can push
   is a client that can rewrite a record.

Invariants 6 and 7 bind rendered pages. They do not bind tools/, which runs on
a developer machine and in CI and ships in nothing.

---

## 3. DATA CONTRACTS, WHICH MUST NOT DRIFT

Capture file. Written by the hotkey, consumed once, deleted.

```
---
captured: 2026-08-29T10:02:00-04:00
id: ab12cd
source: vdi
status: unresolved
---
rotate the ping ciam client secret by friday
```

Item line. One commitment, in people/<name>.md and tasks.md under `## I owe`,
`## Waiting on`, `## Done`.

```
- [ ] rotate the ping ciam client secret (due 2026-09-04) <!--ab12cd 2026-08-29 rolled:1-->
```

Optional comment fields, in any order: rolled:, closed:, v1: a ticket, ext: an
external identity, for: prep linked to an event, by: the engine that classified
it.

Session file. notes/sessions/<yyyy-MM-ddTHHmm>-<6hex>.md, frontmatter then one
line per Enter press, summarised in place between <!--summary--> markers.

Derived identity. ext:gh/<owner>/<repo>#<n>, ext:mcp/<server>/<id>,
ext:note/<session>#<line>. A rerun updates that item and never creates a second
one.

---

## 4. TWO CLASSIFICATION RULES THAT EACH TOOK TWO ATTEMPTS

- The date phrase is stripped from the title only when the date resolved. "fix
  the loader by hand" keeps its phrase and gets no due date.
- Verbs are split. ANYWHERE_VERBS count anywhere in the line: send, ask, draft,
  review, follow up, confirm, reconcile, close out, rotate, deploy, promote,
  provision, redeploy, roll back, cut over, rerun, cordon, terminate, recreate,
  resize, reissue, revoke, decommission, upgrade, migrate. IMPERATIVE_VERBS
  count only at the start: write, call, email, schedule, check, raise,
  document, fix, update, add, remove, set, pin, bump, patch, refactor, rename,
  delete, clean up, restart, scale, tag, publish, enable, disable, restore,
  back up, drain, apply, renew, grant.

The reason: "the pool leaks a set role across connections" is an observation,
and "set the retention" is an instruction. Captures are written in
infrastructure vocabulary, so "rotate the client secret" must be a task.

Match on word boundaries, not substrings. "Anywhere in the line" means anywhere
as a word. A substring test looks correct and passes the obvious cases, then
classifies "the task list is long" and "their asks are unclear" as tasks,
because ask sits inside task and asks. This was found by building the
classifier from this paragraph and probing it, not by reading it — the wrong
version passes every test anybody writes from the examples above. Use \bverb\b,
and test the two sentences named here.

Both rules have tests. If you touch classify_rules, run them first.

---

## 5. TRAPS FOUND THE HARD WAY

- summarize writes the summary into the session file. read_session must skip
  the <!--summary--> region, or every decision appears twice in prep.
- The capture heat map counts capture dates, not decision-log timestamps, which
  are all the single filing run.
- The tab bar uses :has() on .tabwrap. A column-reverse hack scrambles the
  page.
- widgets.css loads last, so a rule there beats an equal-specificity rule in
  topnav.css. Mobile overrides for widgets belong in widgets.css.
- The anomaly detector needs the MAD floor. Without it a flat series scores
  every change as infinite.
- The counts strip is auto-fit. Do not hardcode four columns; the NCOA
  dashboard has five cards.
- :target makes the browser jump to the anchor, so panels carry
  scroll-margin-top and the tab bar is sticky, or it scrolls off screen the
  moment you click a tab.

---

## 6. COMMANDS

```
init
    Does: config, directories, starter files
capture
    Does: write one capture file
file
    Does: classify and file everything in inbox/
brief
    Does: rewrite brief.md
event "NCOA demo" 2026-09-12 --template demo
    Does: an event plus prep items, each due the day before
note "Cluster sync" --attendees a,b
    Does: a session, lines on stdin, each hitting disk immediately
summarize
    Does: actions, waiting, decisions and open questions out of sessions
prep abhishek dani
    Does: what you owe them, what they owe you, prior decisions, open
    questions
eod
    Does: sweep closures, roll overdue, write log/<date>.md
week
    Does: per person rollup into weekly.md
site
    Does: eight static pages from the store
serve
    Does: the same pages on 127.0.0.1:8787, regenerated per request
why <id>
    Does: the chain: input, classification, item, reports
anomalies
    Does: median and MAD over the signals, with a floor for a flat series
remind
    Does: what needs raising, once per item per day
payments
    Does: usage and unit cost from payments/*.csv, Decimal throughout
mirror
    Does: verify a redacted copy before anything is pushed
skill
    Does: draft a procedure from what repeated three times
audit
    Does: the append-only log of every write, refusal and send
export / import
    Does: the whole store, portable
twin
    Does: run the parity harness against a legacy and a modern URL
ingest <files or dir>
    Does: read sources into a corpus; print coverage and gaps
ingest --conflicts
    Does: only where two sources disagree
ingest --build <dir>
    Does: write the application the corpus specifies
```

---

## 7. FILE MAP

```
assistant.py       the engine and the site generator
features.py        audit, approvals, anomalies, payments, cartogram, reminders,
                   webhooks, mirroring, skills
ingest.py          xlsx via zipfile and XML, pdf via zlib streams, csv/md/txt
mcp_server.py      six tools over stdio, no SDK, read only except capture
test_core.py       64 tests, no network
capture.ps1        Ctrl+Alt+C
note.ps1           Ctrl+Alt+N
install.ps1        writes the shortcuts, prints every path, -Uninstall removes them
notify.ps1         sends a report from your own mailbox
assets/            app.css structure, night.css the only theme, topnav.css, widgets.css
tools/             contrast.py, preview.py, shots.py, spec_check.py,
                   parity.mjs, mcp_playwright.mjs, make_icon.py,
                   twinning.mjs, twinning_mcp.mjs,
                   ingest/  readers, corpus, contradictions, generate
deploy/            kustomize base plus a local kind overlay
.github/workflows/ assistant.yml, ci.yml, parity.yml, twinning.yml
config/            four example files, all disabled by default
ncoa/              dashboard.py, sample.json, rbac.md, db-roles.md,
                   V1__app_roles.sql, ASKS.md, NCOA-ASSISTANT.md
ui-real/           nine pages generated from a real store
docs/              BRIEF.md is this brief, written by step 1; the rest is reference
```

---

## 8. THE UI AS BUILT

Pure HTML, dark only, no script. Views in a sliding strip at the top rather
than a sidebar, with counts in the pills and edge fades.

Counts open a sheet listing that set. A row opens a drawer carrying the full
why-chain: input, engine, ticket, where it filed. Close opens a confirm naming
the roll count. Tabs are :target panels with live counts and a sticky bar. A
floating bubble launcher collapses to one Capture pill under 720px.

Five charts, inline SVG computed from the store: opened against closed per day,
capture heat over eight weeks, a fortnight due strip, per-project sparklines,
age bars against the chase threshold.

WCAG 2.1 AA throughout, because Section 508 applies the moment anything is
shared. The contrast gate checks signal colours at 4.5:1 and rule-strong at
3:1, and deliberately does not check rule, the hairline between rows, because
forcing 3:1 there produces the banded tables that make dark mode unreadable.

---

## 9. WINDOWS AND THE VDI

Four conditions handled rather than assumed:

1. Constrained Language Mode blocks Add-Type and COM, so capture falls back to
   a console prompt using no .NET types.
2. A non-persistent profile loses the clone at logoff, so the repo path comes
   from an environment variable with a home-drive fallback, and the clone is
   recreated when missing.
3. A proxy makes an unconfigured push hang rather than fail, so the push is
   detached, time-limited, and warns once when http.proxy is unset.
4. A failed push raises a flag file the next capture shows in its window title,
   because silent failure means captures pile up locally and vanish at logoff.

The edge is a thin client: it writes files and runs git. It classifies nothing
and resolves no dates, because logic there only runs while logged in and cannot
be tested in CI.

---

## 10. DEPLOYMENT

Three postures. Actions only, which is where it runs. A URL through Pages on a
private repo, or a pod behind an ingress doing the OIDC. Kubernetes, EKS Auto
Mode in the cloud and kind locally from the same manifests.

CronJobs carry spec.timeZone so 07:00 America/New_York is 07:00 in November;
GitHub cron is UTC and ignores daylight saving. concurrencyPolicy: Forbid keeps
the single writer. emptyDir and no PersistentVolume, because a ReadWriteOnce
volume shared between a Deployment and Jobs is a scheduling trap. A
NetworkPolicy allows egress only to the git host, the identity provider and
DNS, which is also the hardest enforcement of the source boundaries.

---

## 10A. SPEC-INGEST: THE TOOL THAT MAKES NEW THINGS

Give it what specifies a system; it produces the working application. This is
the piece with the most leverage, because it is how the assistant and the
dashboard get rebuilt anywhere else.

```
  SOURCES                    READERS          CANDIDATE          CORPUS
  ----------------------     -------------    --------------     ----------------
  deck .pptx          \
  document .pdf        \     registry        kind               merge: one line,
  spreadsheet .xlsx     \    claims by       text  (verbatim)   two sources
  API spec openapi       >-> content,   -->  ref   (page/cell)-> dedupe headers
  backlog / stories     /    never by        because (why it     CONTRADICTIONS
  image / screenshot   /     extension       was picked)         coverage + gaps
  codebase (a repo)   /                                                |
  running system     /       pure: no fs,                              v
                             no network                    profile + architecture
                                                          (inferred, not authored)
                                                                       |
                                                                       v
                                                        REPOSITORY: app, tests,
                                                        CI, Terraform, README
```

Eight source kinds, one candidate shape. Everything downstream works on { kind,
text, ref, because } alone. because is the field that matters — a reviewer
judges the reason a line was picked rather than the guess itself.

Rules are found by their language, not by understanding. Normative: must,
shall, may not, is required, at minimum, no later than. Declarative, which is
how specifications are actually written: has a maxLength of, is an enum of,
required on every request, is returned as. And two that earn their own place:

- A stated absence — "there is no such field anywhere in the spec" — is what
  stops a panel being built that nothing can fill.
- A self-correction — "correcting myself", "reversing my earlier answer" — is a
  contradiction with its resolution attached, the highest-value line in a
  thread and the easiest to skim past.

Report every matching reason, not the first. One sentence is often a length
constraint, a stated absence and a self-correction at once, and filing it as
only the first hides the one that matters.

Contradiction detection is the point. Two sources that both assert something
about the same subject and disagree — the deck says 25 MB, the API spec says
100 MB; the story says required, the schema says optional. Each document reads
fine alone, so nobody catches it, and nothing looks missing, so nobody goes
looking. That is the defect that gets built and turns up in UAT. Never resolve
one automatically: put both in front of a person with their sources.

Conversion is the job it exists for. An old system re-expressed as a new one.
The risk is never writing the new code — it is losing a rule that only ever
existed in the old code and that nobody wrote down. So:

- Documents say what the system was meant to do.
- The codebase says what it does. Take routes, field definitions with required
  flags, validators, message contracts, schema, status codes, and configuration
  keys only — a key is structure, a value is a secret. Never carry across a
  credential, a token, or a connection string.
- The running system, via Playwright, when there is no repository.

A rule found in code and in no document is flagged as such. That flag is the
entire value of reading the old system.

Working with nothing configured is the acceptance case. Four stories exported
out of a tracker, no profile, no flags, no plugin, and a running application
comes out — with its inferred entities, fields, states and architecture each
shown beside the sentence that produced it. Every override is a flag, never a
file. A tool that wants JSON before it does anything useful has failed this
regardless of what else passes.

Prose is read as paragraphs, not lines. Source text is hard-wrapped, and
splitting on newlines cuts a rule in half — "values Y, S, D, or" as one
candidate and "N. Tile becomes" as the next. A document's unit is the
paragraph.

Inference may propose, never decide. No LLM and no model-provider SDK or API
key anywhere — a provider package in the lockfile is a build failure. Where the
patterns miss, a local pinned model or the Playwright API may propose a
candidate; it never edits a line, never resolves a contradiction, never
produces a figure, and never reaches generated code unconfirmed. The
deterministic path runs standalone and is the default.

---

## 11. THE PARITY HARNESS

The job: prove a rebuilt page behaves like the one it replaces. It lives
entirely in tools/, runs on Node, and ships in nothing.

One implementation, two front doors. tools/twinning.mjs exports
runTwinning(options) and has a main() for the command line.
tools/twinning_mcp.mjs wraps the same function as an MCP tool over stdio. This
split is not tidiness: an MCP server invoked as a CI step opens a stdio
transport and waits for a client that never connects, so the job hangs and no
check runs. CI calls the runner; an agent calls the server.

```
   LEGACY URL                              MODERN URL
       |                                       |
       v                                       v
  drive the scripted flow             drive the same flow
  (selectors from the                 (selectors: data-testid)
   inventory, not the script)
       |                                       |
       +------------------+--------------------+
                          v
                    COMPARE, in order of what each catches
                    1. a named value after the interaction   -> behaviour drift
                    2. console + page errors, both sides     -> renders but throws
                    3. element count, both sides               -> over-mutation
                    4. a screenshot per side                   -> everything else
                          |
              pass -> exit 0, no telemetry written
              fail -> exit non-zero, .github/healing-telemetry.json,
                      uploaded with if: failure()
```

What it compares, in order of what it catches:

```
A named value after a scripted interaction
    Catches: Behaviour drift — the rebuilt page computing a different total
Console and page errors on either side
    Catches: A rebuild that renders but throws
Element count, both sides
    Catches: Structural over-mutation, when the rebuild grew a layout the
    original never had
A screenshot per side, saved as artifacts
    Catches: Everything the first three miss, for a person to look at
```

Rules that keep it honest:

- A missing element is a failure. Never default a missing value to a literal —
  a fallback total makes the comparison pass against a number somebody typed,
  on a page that is broken. Report which selector was not found, on which side.
- Selectors come from the inventory, not from the script. The legacy side is
  addressed by what it actually exposes; the modern side by data-testid.
  Hardcoding both in the harness means the harness has to be edited for every
  page.
- The element-count threshold is an input with a default, and the default is
  stated. An unexplained magic number gets tuned until it stops complaining.
- Create output directories before writing into them.
- Telemetry is written only on failure, and the workflow uploads it with if:
  failure() and if-no-files-found: ignore, or the job fails on a missing
  artifact when everything passed.

Never in this harness: a credential in a script, an Authorization header or
cookie recorded into any artifact, or a request or response body saved as
anything but its structure. Authentication is a hand-driven login saved to a
gitignored storage state and reused.

No model, and no model-provider SDK, anywhere. Not in the harness, not in the
assistant, not in the generated pages. Where Playwright can answer a question
about a page, ask Playwright. This is the same rule as docs/EXTRAS.md records
for machine learning: nothing here is a learning problem, it cannot install on
a locked-down endpoint, and it would train on too few examples to beat the
rules it replaced. If the classification rules start missing, the answer is a
Naive Bayes over the decision log — about forty lines of pure Python.

The workflow. node-version: 20, not node-size. npm ci, then npx playwright
install --with-deps chromium, then the runner, not the MCP server. It runs in
CI and on a developer machine, never on the VDI.

---

## 12. THE NCOA+ DASHBOARD

ncoa/dashboard.py reads ncoa/sample.json and writes five pages: overview with
counts and a 14-day volume chart, records with a drawer per record showing its
full processing history, feeds with freshness against SLA and the last error,
charges, and activity. Same dark theme and widget CSS, no script. Swap the JSON
for real data and it regenerates.

ncoa/rbac.md defines the access model separately: three roles, a read table, an
action table, and who decides who gets what. Nobody in the system grants access
in the system; membership lives in ARIS and the application only reads it.

---

## 13. KNOWN DEBT, IN PRIORITY ORDER

Full list with severities in docs/TECHDEBT.md. The top four:

1. Waiting items never roll and age through a different mechanism than tasks.
   Decide one model; it is a design question hiding as a bug.
2. No file locking. Two processes appending to the same file can interleave.
   The single-writer rule prevents it in Actions and in CronJobs; nothing
   prevents it locally.
3. _ROOT_OVERRIDE is a module global with a context manager. Correct
   single-threaded, wrong under concurrency. The honest fix threads the root
   through every signature.
4. append_under works and nobody can say why. Rewrite it.

The rule for docs/TECHDEBT.md: add an entry in the same commit as the shortcut,
with the reason. And verify a defect against the store before writing it down —
two entries in that file were wrong because they were read off a rendered page
instead of the files behind it, and a wrong entry is worse than a missing one,
because someone will eventually "fix" working code to match it.

---

## 14. NOT BUILT, AND WHY

Blocked on other people rather than effort:

```
OpenAPI and token lifecycle
    Blocked on: nothing to authenticate while serve binds to 127.0.0.1 with
    no flag to change it
Ping and ARIS
    Blocked on: a claim name observed from a real token; AUTH_MODE=token
    holds until then
React package
    Blocked on: a build chain, and the HTML pages open faster and cost
    nothing to keep
VersionOne lookup
    Blocked on: needs an MCP server for it to exist
```

Deliberately out, each recorded with its reason in docs/EXTRAS.md: recurring
commitments, snooze, multi-user identity, a mobile app beyond two Apple
Shortcuts, and any machine learning.

---

## 15. DONE MEANS

- python3 -m unittest test_core passes. It covers, at minimum: an unrecognised
  comment field surviving a sweep and a roll; a roll incrementing the count and
  not moving the due date; a 22:00 Eastern capture filing under the local date
  with ASSISTANT_NOW set; "fix the loader by hand" keeping its phrase and
  taking no due date; "the pool leaks a set role" classified as an observation
  while "set the retention" is a task; "the task list is long" and "their asks
  are unclear" classified as observations, which is the word-boundary test from
  section 4 and the one a substring implementation fails; and a rerun of the
  same external identity updating one item rather than creating a second.
- python3 tools/contrast.py assets/night.css passes, checking signal colours at
  4.5:1 and rule-strong at 3:1 and not checking rule.
- python3 tools/spec_check.py docs/BRIEF.md verifies every claim in the brief
  against the code — the same file Step 1 wrote. This is the habit that
  matters: adding a command means adding it to the brief or CI fails. Every
  command in section 6 must appear in assistant.py's dispatch, and every entry
  in the section 7 file map must exist.
- No rendered page contains <script>, an on attribute, a <style> block, or a
  style attribute. Grep the generated site, not the source.
- No import outside tools/ is absent from sys.stdlib_module_names.
- node tools/twinning.mjs --legacy <url> --modern <url> runs to a verdict and
  exits non-zero on a mismatch. A missing selector is a failure naming the
  selector and the side, never a defaulted value.
- The twinning workflow goes green on a first push, and its artifact upload
  does not fail a passing run.
- Spec-ingest reads a real document and a real repository, not a fixture.
  Assert: a .pptx and a .pdf with a subsetted font both come out as text; an
  .xlsx resolves shared strings and places a row with an empty cell in the
  right columns; prose is read as paragraphs so no rule arrives split; a stated
  absence and a self-correction are each classified with their reason; every
  matching reason is reported, not the first; and no credential, token or
  connection string appears anywhere in the output of the codebase reader.
- Contradiction detection is tested on sources that genuinely disagree and on
  sources that agree, because a false conflict costs more than a missed one.
- The four-stories case runs with no arguments — no profile, no flags — and
  produces a running application with each inference shown beside the sentence
  that produced it.
- No model-provider SDK is installed. A test greps the lockfile and the
  environment for one and fails on either.
- A README stating plainly what this is not: not a work tracker, not a
  replacement for VersionOne, no database, and no page that measures a person.

---

## APPENDIX A. THE FOUR ARTIFACTS, CORRECTED AND READY TO WRITE

These are files to create, not illustrations. Each is the circulating sample
with its defects fixed; section 0 lists what was wrong and why. Write them as
given.

### A1. tools/twinning.mjs — the runner

The parity check itself. CI calls this. It exports a function so the MCP server
in A3 can call the same code rather than a second copy of it.

```javascript
/**
 * Parity between a legacy page and its rebuild.
 *
 * A missing element is a failure, never a default. The original sample fell
 * back to a hardcoded total, so a broken legacy page compared successfully
 * against a number somebody had typed into the harness.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Read one selector, or say which side and which selector was missing. */
async function textOf(page, selector, side) {
  const el = page.locator(selector)
  if ((await el.count()) === 0) {
    throw new Error(`${side}: no element matched ${selector}`)
  }
  return (await el.first().innerText()).trim()
}

const write = (path, body) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

/**
 * @param {object} o
 * @param {string} o.legacyUrl
 * @param {string} o.modernUrl
 * @param {{fill?:[string,string][], click?:string[], read:string}} o.legacy
 * @param {{fill?:[string,string][], click?:string[], read:string}} o.modern
 * @param {boolean} [o.screenshots]
 * @param {number} [o.elementDrift] absolute element-count difference tolerated.
 *   Default 150 is a starting point, not a measurement: set it from a run
 *   where the two pages are known to match, or it gets raised until it stops
 *   complaining.
 * @param {string} [o.outDir]
 */
export async function runTwinning(o) {
  const {
    legacyUrl, modernUrl, legacy, modern,
    screenshots = false, elementDrift = 150, outDir = 'artifacts/twinning',
  } = o

  const result = { status: 'PASS', errors: [], observed: {} }
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })

  const drive = async (page, url, steps, side) => {
    page.on('pageerror', (e) => result.errors.push(`${side} page error: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') result.errors.push(`${side} console: ${m.text()}`)
    })
    await page.goto(url, { waitUntil: 'networkidle' })
    for (const [sel, value] of steps.fill ?? []) await page.fill(sel, value)
    for (const sel of steps.click ?? []) await page.click(sel)
    // Wait for the app to settle, not for a fixed 500ms that is either wasted
    // or not enough depending on the machine.
    await page.waitForLoadState('networkidle')
    return textOf(page, steps.read, side)
  }

  try {
    const legacyPage = await context.newPage()
    const modernPage = await context.newPage()

    const legacyValue = await drive(legacyPage, legacyUrl, legacy, 'legacy')
    const modernValue = await drive(modernPage, modernUrl, modern, 'modern')
    result.observed = { legacyValue, modernValue }

    if (legacyValue !== modernValue) {
      result.errors.push(`value mismatch: legacy "${legacyValue}", modern "${modernValue}"`)
    }

    const count = (p) => p.evaluate(() => document.querySelectorAll('*').length)
    const [lc, mc] = [await count(legacyPage), await count(modernPage)]
    result.observed.elements = { legacy: lc, modern: mc, tolerated: elementDrift }
    if (Math.abs(lc - mc) > elementDrift) {
      result.errors.push(
        `element count drift ${Math.abs(lc - mc)} exceeds ${elementDrift} (legacy ${lc}, modern ${mc})`,
      )
    }

    if (screenshots) {
      mkdirSync(outDir, { recursive: true })
      await legacyPage.screenshot({ path: `${outDir}/legacy.png`, fullPage: true })
      await modernPage.screenshot({ path: `${outDir}/modern.png`, fullPage: true })
    }
  } catch (err) {
    result.errors.push(`run failed: ${err.message}`)
  } finally {
    await browser.close()
  }

  if (result.errors.length) {
    result.status = 'FAIL'
    write('artifacts/twinning/telemetry.json', JSON.stringify(result, null, 2))
  }
  return result
}

async function main() {
  const arg = (n) => {
    const i = process.argv.indexOf(`--${n}`)
    return i === -1 ? undefined : process.argv[i + 1]
  }
  const legacyUrl = arg('legacy')
  const modernUrl = arg('modern')
  if (!legacyUrl || !modernUrl) {
    console.error('usage: twinning.mjs --legacy <url> --modern <url> [--config <file>]')
    process.exit(2)
  }
  // Selectors belong to the page being tested, not to the harness. Without a
  // config the harness has nothing to drive and says so.
  const configPath = arg('config')
  if (!configPath) {
    console.error('--config is required: it names the selectors for each side')
    process.exit(2)
  }
  const cfg = JSON.parse((await import('node:fs')).readFileSync(configPath, 'utf8'))
  const result = await runTwinning({ legacyUrl, modernUrl, screenshots: true, ...cfg })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.status === 'PASS' ? 0 : 1)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
```

A config names the selectors, so the harness is not edited per page:

```json
{
  "legacy": {
    "fill": [["#coupon", "SUMMER50"]],
    "click": ["#checkout-submit"],
    "read": "#total-display"
  },
  "modern": {
    "fill": [["[data-testid=\"coupon-field\"]", "SUMMER50"]],
    "click": ["[data-testid=\"checkout-submit\"]"],
    "read": "[data-testid=\"order-total\"]"
  },
  "elementDrift": 150
}
```

### A2. console/src/DashboardCore.tsx — the React console

A separate product, per section 0 item 3: its own directory, its own build, its
own tests. It does not import the assistant's CSS, and nothing the assistant
generates imports it. Every interactive element carries a data-testid so the A1
harness can drive it without the selectors being guessed.

```tsx
import React, { useState } from 'react'
import { LayoutDashboard, ChevronRight, Activity, Layers, Sparkles } from 'lucide-react'

export const DashboardCore: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'logs'>('analytics')

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans antialiased flex">
      <aside className="w-64 bg-white border-r border-slate-200/60 p-5 flex-col justify-between hidden md:flex">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="h-6 w-6 rounded bg-slate-950 flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Helix Core v4.1</span>
          </div>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              aria-current={activeTab === 'analytics' ? 'page' : undefined}
              data-testid="nav-analytics"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 ${
                activeTab === 'analytics'
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-3.5 w-3.5" /> Analytics Console
              </span>
              <ChevronRight className="h-3 w-3 opacity-60" />
            </button>
          </nav>
        </div>
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm" />
          <div>
            <p className="text-xs font-medium text-slate-800">Operational Node</p>
            <p className="text-[10px] text-slate-400 font-mono">node_0x992a.live</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA]">
        <header className="h-14 bg-white border-b border-slate-200/60 px-8 flex items-center justify-between">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Environments</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-900 font-semibold">Production Cloud Cluster</span>
          </nav>
          <button
            type="button"
            data-testid="global-sync-btn"
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-medium rounded-lg shadow-sm transition-all duration-200 ease-out flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400 motion-safe:animate-pulse" />
            Force Global Synchronize
          </button>
        </header>

        <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { id: 'compute', label: 'Compute Allocation', value: '94.2%', rate: '+2.1%', desc: 'Current active vCPU cluster utility.' },
              { id: 'network', label: 'Network Throughput', value: '4.8 GB/s', rate: 'Optimal', desc: 'Ingress routing capacity threshold.' },
              { id: 'database', label: 'Database Mutation Frequency', value: '14,204/s', rate: '+12.4%', desc: 'Strict read/write operation tracking.' },
            ].map((stat) => (
              <div
                key={stat.id}
                data-testid={`metric-card-${stat.id}`}
                className="bg-gradient-to-b from-white to-slate-50/50 border border-slate-200/60 p-5 rounded-xl shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</span>
                  <span
                    data-testid={`metric-rate-${stat.id}`}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      stat.rate.startsWith('+')
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {stat.rate}
                  </span>
                </div>
                <h3
                  data-testid={`metric-value-${stat.id}`}
                  className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums"
                >
                  {stat.value}
                </h3>
                <p className="text-xs text-slate-500 leading-normal">{stat.desc}</p>
              </div>
            ))}
          </div>

          <section
            id="stream-feature-injection-zone"
            data-testid="injection-container-root"
            className="bg-white border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]"
          >
            <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-800">Dynamic Feature Ingestion Hub</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Drop markdown patches into the stream workflow to integrate features inside this container.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
```

Four corrections against the sample, each with a reason: hidden md:flex cannot
both hide and show, so the flex moves off the base class; type="button" stops a
button inside any future form submitting it; animate-pulse becomes
motion-safe:animate-pulse and every control gains a visible focus ring, because
a keyboard user and somebody with reduced-motion set are both real; and the
metric cards key on a stable id rather than an array index, so a reordered list
does not reuse the wrong DOM node.

### A3. tools/twinning_mcp.mjs — the MCP wrapper

The same function as A1, exposed to an agent. It never duplicates the logic.

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { runTwinning } from './twinning.mjs'

const server = new Server(
  { name: 'twinning', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'run_twinning',
      description:
        'Drive a legacy page and its rebuild through the same flow and compare a named value, console errors and element count.',
      inputSchema: {
        type: 'object',
        properties: {
          legacyUrl: { type: 'string' },
          modernUrl: { type: 'string' },
          legacy: { type: 'object', description: 'fill, click, read selectors for the legacy side' },
          modern: { type: 'object', description: 'fill, click, read selectors for the rebuild' },
          screenshots: { type: 'boolean' },
          elementDrift: { type: 'number' },
        },
        required: ['legacyUrl', 'modernUrl', 'legacy', 'modern'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'run_twinning') {
    throw new Error(`unknown tool: ${request.params.name}`)
  }
  const result = await runTwinning(request.params.arguments)
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

await server.connect(new StdioServerTransport())
```

### A4. .github/workflows/twinning.yml

```yaml
name: Twinning parity
on: [push, pull_request]

jobs:
  verify-parity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20          # not node-size; the sample fails at setup
          cache: npm

      - run: npm ci

      - run: npx playwright install --with-deps chromium

      - name: Start the rebuild under test
        run: npm run preview &

      - name: Wait for it to answer
        run: npx wait-on http://127.0.0.1:4173 --timeout 60000

      # The runner, never the MCP server: a stdio server here waits for a
      # client that never connects and the job hangs until it is killed.
      - name: Parity run
        run: >
          node tools/twinning.mjs
          --legacy ${{ vars.LEGACY_URL }}
          --modern http://127.0.0.1:4173
          --config tools/twinning.config.json

      - name: Archive telemetry
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: twinning-telemetry
          path: artifacts/twinning/
          if-no-files-found: ignore
```

No continue-on-error. A parity failure should fail the build — the sample
swallowed it and then tried to upload an artifact that a passing run never
wrote.

### A5. The ingestion instruction, for the React console only

Write to console/AGENTS.md. It governs A2's product, not the assistant's pages,
which invariants 6 and 7 still bind absolutely.

```markdown
# Ingesting a feature patch into the console

Scope: `console/` only. Never edit anything the assistant generates, and never
add a script tag, a style attribute, or a light surface to a page under
`assets/`, `ui-real/`, or `ncoa/`.

## Design constraints

- Sans-serif hierarchy; `tracking-tight` on headings, `tracking-wider text-xs`
  on uppercase micro-labels.
- Outer padding `p-6` or `p-8`; inner rhythm on one gap scale, `gap-4` or
  `space-y-4`. Do not mix scales in one view.
- 1px semi-transparent borders (`border-slate-200/60`), `shadow-sm` over a
  `bg-gradient-to-b from-white to-slate-50/50` surface. No heavy black
  shadows.
- `duration-200 ease-out` on interactive transitions; `active:scale-[0.98]`
  on buttons. Wrap ambient motion in `motion-safe:`.
- Every interactive element takes a visible focus ring and an accessible name.

## What every generated element carries

A `data-testid` on every interactive control, form field and computed value,
so the A1 harness addresses the rebuild by contract rather than by guessing at
class names. A testid is part of the component's API: renaming one is a
breaking change and updates `tools/twinning.config.json` in the same commit.

## The loop

1. Read the patch. Name which components change and which container they mount
   into.
2. Generate against the constraints above, with the testids.
3. Re-read the diff adversarially before returning it: duplicated utility
   classes that cancel, a `hidden` beside a `flex`, an index used as a key, a
   control with no focus state, motion with no `motion-safe:` guard.
4. Run `npm run build`, the unit tests, and `node tools/twinning.mjs` against
   the config. Return only after all three are clean.

Never claim self-healing for output nothing executed. A generated payload is a
proposal until the build, the tests and the parity run agree.
```

---

## APPENDIX B. THE TOOLING STACK, AND WHERE IT DOES AND DOES NOT APPLY

A stack in circulation, worth stating because half of it is a good default and
half of it breaks the invariants in section 2. Read the scoping before adopting
any of it.

```
Build — writes the code
    Options: Claude Code; Cursor
    Applies here?: Yes. This is how everything in this brief gets built. No
    constraint touches it: it runs on a developer machine, produces files,
    and ships in nothing.
App — front end from a description
    Options: Lovable; Replit
    Applies here?: No, for anything in this brief. Both host the app and its
    build chain. Section 2 requires static files served from git with no
    build chain on the VDI, and §9's proxy and non-persistent-profile
    conditions rule out a hosted editor as the source of truth. Fine for a
    throwaway prototype nobody has to run on the VDI.
Database — where data lives
    Options: Supabase; Airtable
    Applies here?: No. Invariant 2 forbids a database at any size, in any
    deployment posture. This is the invariant most often argued with and the
    one worth holding: the store is files in git, which is what makes why
    <id>, export, and the audit log trivially true rather than a feature to
    build. When files stop being enough, that is a different product and a
    deliberate decision, not a library swap.
Automation — connecting tools
    Options: Zapier; n8n
    Applies here?: Only n8n, self-hosted, and only outside the VDI. Both send
    data to a third party by design; a hosted automation platform holding
    commitments, meeting notes, or NCOA records is a data-egress decision
    with a security review attached, not a tooling preference. The §10
    NetworkPolicy allows egress to the git host, the identity provider and
    DNS — nothing else — and that is deliberate.
```

So the stack that applies here is one layer, not four: Claude Code or Cursor to
build, git for the store, GitHub Actions or a CronJob for the schedule. That is
not a smaller version of the four-layer stack; it is what the constraints
leave, and every layer it drops is a layer that would have to hold the data.

When the four-layer stack is right. A new internal tool with no VDI
requirement, no locked-down endpoint, and data nobody has to keep inside the
estate. Then it is a genuinely fast way to replace an overpriced subscription,
and this brief is not the reason to avoid it. Say which situation you are in
before picking, because the two answers are opposite and both are correct in
their own case.

The question that decides it, and it is not a technical one: may this data sit
on somebody else's infrastructure? Answer that first. Every other choice in the
table follows from it, and answering it late means migrating under pressure.
