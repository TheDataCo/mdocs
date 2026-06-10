import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { Command } from 'commander'
import { Api, ApiError } from './api.js'
import { loadConfig, resolve, saveConfig } from './config.js'
import { findByPath, getEntry, setEntry } from './manifest.js'

// Exit codes (stable for agents/CI).
const EXIT: Record<string, number> = {
  ok: 0,
  generic: 1,
  usage: 2,
  auth_failed: 3,
  permission_denied: 4,
  not_found: 5,
  stale_manifest: 6,
  patch_conflict: 7,
  network: 8,
  server_error: 9,
}

function fail(code: string, message: string): never {
  process.stderr.write(`mdocs: ${message}\n`)
  process.exit(EXIT[code] ?? 1)
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  try {
    spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref()
  } catch {
    /* fall back to printing the URL */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'untitled'
  )
}

const program = new Command()
program.name('mdocs').description('mdocs — Docs for Markdown').version('0.1.0')
program.option('--server <url>', 'mdocs server URL')
program.option('--json', 'machine-readable output')

const api = () => {
  const { server, token } = resolve(program.opts())
  return new Api(server, token)
}

// ---- auth ----
const auth = program.command('auth').description('Authenticate with mdocs')

auth
  .command('login')
  .description('Log in via the website (device authorization)')
  .action(async () => {
    const { server } = resolve(program.opts())
    const client = new Api(server)
    const start = await client.startAuth().catch((e: ApiError) => fail(e.code, e.message))
    const url: string = start.verification_uri_complete
    process.stdout.write(`\n  Confirm this code in your browser: ${start.user_code}\n  ${url}\n\n`)
    openBrowser(url)

    const deadline = Date.now() + start.expires_in * 1000
    const interval = (start.interval ?? 2) * 1000
    process.stdout.write('  Waiting for approval…')
    while (Date.now() < deadline) {
      await sleep(interval)
      const poll = await client.pollAuth(start.device_code).catch(() => ({ status: 'pending' }))
      if (poll.status === 'approved') {
        saveConfig({ server, token: poll.token })
        const me = await new Api(server, poll.token).me().catch(() => ({ user: null }))
        process.stdout.write(`\r  ✓ Logged in${me.user?.email ? ` as ${me.user.email}` : ''}.            \n`)
        return
      }
      if (poll.status === 'expired') fail('auth_failed', 'Login request expired. Try again.')
      process.stdout.write('.')
    }
    fail('auth_failed', 'Timed out waiting for approval.')
  })

auth
  .command('logout')
  .description('Remove stored credentials')
  .action(() => {
    const cfg = loadConfig()
    saveConfig({ server: cfg.server })
    process.stdout.write('Logged out.\n')
  })

program
  .command('whoami')
  .description('Show the logged-in user')
  .action(async () => {
    const { user } = await api()
      .me()
      .catch((e: ApiError) => fail(e.code, e.message))
    if (program.opts().json) return void process.stdout.write(JSON.stringify(user) + '\n')
    process.stdout.write(user ? `${user.email}\n` : 'Not logged in as a user.\n')
  })

// ---- docs ----
program
  .command('ls')
  .description('List accessible documents')
  .action(async () => {
    const { docs } = await api()
      .listDocs()
      .catch((e: ApiError) => fail(e.code, e.message))
    if (program.opts().json) return void process.stdout.write(JSON.stringify(docs) + '\n')
    if (docs.length === 0) return void process.stdout.write('No documents.\n')
    for (const d of docs) process.stdout.write(`${d.id}  ${d.title}\n`)
  })

program
  .command('pull <doc> [path]')
  .description('Pull a document to a local .md file')
  .option('-f, --force', 'overwrite an existing unmanaged file')
  .action(async (docId: string, path: string | undefined, opts: { force?: boolean }) => {
    const { server } = resolve(program.opts())
    const res = await api()
      .pull(docId)
      .catch((e: ApiError) => fail(e.code, e.message))
    const dest = path ?? `${slugify(res.doc.title)}.md`
    if (existsSync(dest) && !opts.force && !getEntry(docId) && !findByPath(dest)) {
      fail('generic', `${dest} already exists. Use --force or give a different path.`)
    }
    writeFileSync(dest, res.content)
    setEntry(
      { docId, path: dest, server, baseVersion: res.version.n, baseHash: res.version.contentHash },
      res.content,
    )
    if (program.opts().json) {
      process.stdout.write(JSON.stringify({ path: dest, version: res.version.n }) + '\n')
    } else {
      process.stdout.write(`Pulled "${res.doc.title}" → ${dest} (version ${res.version.n})\n`)
    }
  })

program.parseAsync().catch((e) => fail(e.code ?? 'generic', e.message ?? String(e)))
