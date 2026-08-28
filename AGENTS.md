# Working on the Addressing Console

Scope: this branch (`Console`) only — `console-app/`. The full brief is
[`Console.md`](Console.md); read the numbered section a task references
before changing the page or logic that section governs.

## Hard constraints

- Browser-only, no backend, no real credentials. No `type="password"`
  field anywhere in the built output — grep `dist/` for it before calling
  a change done.
- No model, no model-provider SDK, no API key, no `fetch(`/`XMLHttpRequest`
  in `dist/`. Grep the **built bundle**, not the repository — scripts and
  tests are not the bundle and are not covered by this check.
- Build domain logic before UI, and look at the *rendered* result before
  trusting a passing unit test — the worst bugs in the original build were
  aggregation errors every unit test passed and a glance at the chart
  caught immediately (see `README.md`'s "Known pain points"): balance-
  over-time must be the total position per date, not a raw per-account
  running balance, and closing balance is the sum of per-account closing
  balances, not the latest row's value.
- Pending/rejected ledger rows are displayed but excluded from every
  aggregate — only settled rows move money.
- MUI v7's `Grid` takes `size={{...}}`, not `item`/bare breakpoints; there
  is no `Unstable_Grid2` fallback.
- A `react-router-dom` v7 `BrowserRouter` needs the nginx `try_files`
  fallback in `nginx.conf`, or a deep link 404s on first load even though
  `npm run dev` never reveals it.

## The loop

1. Read the brief section the task references
   (`grep -n "^## " ../Console.md` if working from `console-app/`).
2. Implement the domain logic first, with a unit test, before touching a
   page component.
3. Run `npm run build` (`tsc -b && vite build`) and `npm run lint`; fix
   everything before returning.
4. If the change affects a rendered page, run `npm run dev` and look at it
   — an aggregation bug reads correct in code and wrong in the chart.

Never claim something works because it compiles. A generated page is a
proposal until the build, lint, and a look at the rendered result all
agree — the same rule this repo applies to everything it generates.
