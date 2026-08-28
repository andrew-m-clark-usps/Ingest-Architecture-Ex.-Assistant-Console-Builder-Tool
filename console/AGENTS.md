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
so the `tools/twinning.mjs` harness addresses the rebuild by contract rather
than by guessing at class names. A testid is part of the component's API:
renaming one is a breaking change and updates `tools/twinning.config.json`
in the same commit.

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

(From Exec-Assistant.md Appendix A5 -- written as given.)
