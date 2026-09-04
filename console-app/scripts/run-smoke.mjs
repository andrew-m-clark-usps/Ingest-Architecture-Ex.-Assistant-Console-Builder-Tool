#!/usr/bin/env node
import http from 'node:http'
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const PORT = 4173
const START_TIMEOUT_MS = 60_000
const RETRY_DELAY_MS = 250

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const viteCli = join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')
const playwrightCli = join(rootDir, 'node_modules', 'playwright', 'cli.js')

async function ensureBuildExists() {
  await access(join(rootDir, 'dist', 'index.html'))
  await access(viteCli)
  await access(playwrightCli)
}

function stopProcess(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => resolve({ code, signal }))
    child.once('error', reject)
  })
}

function probeServer() {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: HOST, port: PORT, path: '/' }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
  })
}

async function waitForServer(child) {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    const exit = child.exitCode
    if (exit !== null) throw new Error(`preview server exited early with code ${exit}`)
    try {
      const status = await probeServer()
      if (status >= 200 && status < 500) return
    } catch {
      // Keep polling until timeout; ECONNREFUSED is expected before Vite binds.
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }
  throw new Error(`preview server did not become ready on http://${HOST}:${PORT} within ${START_TIMEOUT_MS}ms`)
}

async function runPlaywright() {
  const child = spawn(process.execPath, [playwrightCli, 'test'], {
    cwd: rootDir,
    env: { ...process.env, PLAYWRIGHT_MANUAL_SERVER: '1' },
    stdio: 'inherit',
    shell: false,
  })
  const { code, signal } = await waitForExit(child)
  if (signal) throw new Error(`playwright terminated with signal ${signal}`)
  return code ?? 1
}

async function main() {
  await ensureBuildExists()

  const preview = spawn(process.execPath, [viteCli, 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })

  const cleanup = () => stopProcess(preview)
  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(143)
  })

  try {
    await waitForServer(preview)
    process.exit(await runPlaywright())
  } finally {
    cleanup()
  }
}

await main()