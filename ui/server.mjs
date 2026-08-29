#!/usr/bin/env node
// Lightweight browser UI for the Spec-Ingest Tool. Zero runtime
// dependencies (node:http only) — see AGENTS.md / Spec-Ingest-Tool.md
// section 1A, "full-stack service" delivery shape: one directory instead
// of a file passed round.
//
// This is a shell, same tier as cli.mjs: it touches the filesystem and the
// network so the pure core in ../src never has to. It reuses the exact
// same sniff-and-read loop as the CLI via ingestRunner.mjs so the two
// never disagree about what counts as "read" vs. "skipped" vs. "refused".
//
// No client-side JavaScript anywhere in a rendered page — no <script>, no
// on* attribute, no <style> block/attribute — per the shared invariant
// stated in Spec-Ingest-Tool.md and README.md. Every page is a plain form
// or link; styling is an external stylesheet served as its own response.
import { createServer } from 'node:http'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ingestPaths, genericProfile } from '../ingestRunner.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const DATA_DIR = process.env.INGEST_DATA_DIR ?? join(process.cwd(), 'data')
const MAX_BODY_BYTES = 64 * 1024 // form bodies here are a handful of checkbox names, never large

// Every document read is untrusted input (README.md "Security"). A
// malformed PDF/PPTX/YAML can embed text crafted to look like markup; an
// error message can echo a fragment of that text. Nothing derived from a
// document — a path, an error message, a contradiction's claim/ref — is
// ever written into a response without this escape.
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header><h1>Spec-Ingest Tool</h1></header>
<main>
${body}
</main>
</body>
</html>`
}

// Server-authoritative listing: the only paths ever opened are ones this
// process just enumerated itself from DATA_DIR. A request never supplies a
// filesystem path directly — only a name, matched by exact equality
// against this listing — so there is no path-traversal surface to defend
// even before the belt-and-suspenders checks below.
function listDataDir() {
  if (!existsSync(DATA_DIR)) return []
  return readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function renderHome() {
  const entries = listDataDir()
  if (!existsSync(DATA_DIR)) {
    return page(
      'Spec-Ingest Tool',
      `<p>No data directory found at <code>${escapeHtml(DATA_DIR)}</code>.</p>
<p>Mount a directory of files to ingest there — for example:</p>
<pre>docker run -p ${PORT}:${PORT} -v /path/to/your/files:/data spec-ingest-ui</pre>`
    )
  }
  if (entries.length === 0) {
    return page(
      'Spec-Ingest Tool',
      `<p>The data directory <code>${escapeHtml(DATA_DIR)}</code> is empty.</p>
<p>Drop in a <code>.pdf</code>, <code>.pptx</code>, <code>.xlsx</code>, an OpenAPI/Swagger
<code>.json</code>/<code>.yaml</code> file, or a codebase directory, then reload this page.</p>`
    )
  }
  const rows = entries
    .map(
      (e) => `<li>
  <label><input type="checkbox" name="path" value="${escapeHtml(e.name)}"> ${escapeHtml(e.name)}${e.isDirectory ? ' <em>(directory, read as a codebase)</em>' : ''}</label>
  — <a href="/run?path=${encodeURIComponent(e.name)}">run only this</a>
</li>`
    )
    .join('\n')
  return page(
    'Spec-Ingest Tool',
    `<p>Reading from <code>${escapeHtml(DATA_DIR)}</code>. Nothing here is claimed by its
extension — each entry is sniffed by content, same as the CLI.</p>
<form method="POST" action="/run">
<ul>
${rows}
</ul>
<button type="submit">Run selected</button>
</form>
<p><a href="/run?all=1">Run all</a></p>`
  )
}

function renderReport(paths) {
  return ingestPaths(paths).then(({ fileReports, corpus, coverage }) => {
    const fileRows = fileReports
      .map((r) => `<li class="status-${r.status}"><strong>${r.status}:</strong> <code>${escapeHtml(r.path)}</code>${r.detail ? ` — ${escapeHtml(r.detail)}` : ''}</li>`)
      .join('\n')
    const coverageRows = coverage
      .map((section) => {
        const status =
          section.count > 0
            ? `${section.count} candidate(s)`
            : section.unreachable
              ? 'unreachable'
              : `empty — ${genericProfile.sections.find((s) => s.section === section.section)?.fill ?? ''}`
        return `<li>${section.section}. ${escapeHtml(section.title)}: ${escapeHtml(status)}</li>`
      })
      .join('\n')
    const contradictionRows = corpus.contradictions.length
      ? `<h2>Contradictions</h2>
<p>Silence is not agreement — this is only what was detectable.</p>
<ul>
${corpus.contradictions
  .map(
    (c) =>
      `<li>[${escapeHtml(c.kind)}] ${c.claims.map((claim) => `${escapeHtml(claim.value)} (${escapeHtml(claim.ref)})`).join(' vs. ')}</li>`
  )
  .join('\n')}
</ul>`
      : ''
    return page(
      'Spec-Ingest Tool — result',
      `<p><a href="/">&larr; back</a></p>
<h2>Files</h2>
<ul>
${fileRows}
</ul>
<h2>Coverage</h2>
<ul>
${coverageRows}
</ul>
${contradictionRows}`
    )
  })
}

async function readBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function resolveSelection(requestedNames) {
  const entries = listDataDir()
  const byName = new Map(entries.map((e) => [e.name, e]))
  const selected = requestedNames.filter((name) => byName.has(name) && !name.includes('/') && !name.includes('\\') && !name.includes('..'))
  return selected.map((name) => join(DATA_DIR, name))
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderHome())
      return
    }

    if (req.method === 'GET' && url.pathname === '/style.css') {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' })
      // fs functions accept a file:// URL directly — no manual path-from-URL
      // conversion needed (that conversion is easy to get wrong on Windows).
      res.end(readFileSync(new URL('./style.css', import.meta.url)))
      return
    }

    if (req.method === 'GET' && url.pathname === '/run') {
      const requested = url.searchParams.get('all') === '1' ? listDataDir().map((e) => e.name) : url.searchParams.getAll('path')
      const paths = resolveSelection(requested)
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(await renderReport(paths))
      return
    }

    if (req.method === 'POST' && url.pathname === '/run') {
      const body = await readBody(req)
      const requested = new URLSearchParams(body).getAll('path')
      const paths = resolveSelection(requested)
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(await renderReport(paths))
      return
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
  } catch (err) {
    res.writeHead(err.message === 'request body too large' ? 413 : 500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`error: ${err.message}`)
  }
})

server.listen(PORT, () => {
  console.log(`Spec-Ingest UI listening on http://localhost:${PORT}`)
  console.log(`Reading from ${DATA_DIR}`)
})
