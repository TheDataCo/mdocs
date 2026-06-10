import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { Api, ApiError } from './api.js'
import { loadConfig, resolve, saveConfig } from './config.js'
import { INSTRUCTIONS } from './instructions.js'
import { findByPath, getEntry, listEntries, setEntry } from './manifest.js'
import { SKILL_MD } from './skill.js'

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

// Read the real version from package.json (next to dist/), so it never drifts.
function pkgVersion(): string {
  try {
    const p = join(dirname(fileURLToPath(import.meta.url)), '../package.json')
    return JSON.parse(readFileSync(p, 'utf8')).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const program = new Command()
program.name('mdocs').description('mdocs — Docs for Markdown').version(pkgVersion())
program.option('--server <url>', 'mdocs server URL')
program.option('--json', 'machine-readable output')
// Agents: a single command that fully explains the tool.
program.addHelpText('after', '\nAgents/LLMs: run `mdocs instructions` for a complete machine-readable guide.\n')

program
  .command('instructions')
  .description('Print a complete guide for agents/LLMs (llm.txt style)')
  .action(() => {
    process.stdout.write(INSTRUCTIONS)
  })

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
  .option('--rev <n>', 'pull a specific historical version (read-only, not linked)')
  .action(async (docId: string, path: string | undefined, opts: { force?: boolean; rev?: string }) => {
    const { server } = resolve(program.opts())
    // Historical version: fetch that version's text to a file; don't link/track it.
    if (opts.rev) {
      const text = await api()
        .versionContent(docId, Number(opts.rev))
        .catch((e: ApiError) => fail(e.code, e.message))
      const dest = path ?? `${docId}.v${opts.rev}.md`
      if (existsSync(dest) && !opts.force) fail('generic', `${dest} exists; use --force.`)
      writeFileSync(dest, text)
      process.stdout.write(`Wrote version ${opts.rev} → ${dest} (read-only snapshot)\n`)
      return
    }
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

const ws = program.command('workspaces').alias('ws').description('List or create workspaces')

ws.command('list', { isDefault: true })
  .description('List your workspaces (ids for `new --workspace`)')
  .action(async () => {
    const { workspaces } = await api()
      .listWorkspaces()
      .catch((e: ApiError) => fail(e.code, e.message))
    if (program.opts().json) return void process.stdout.write(JSON.stringify(workspaces) + '\n')
    for (const w of workspaces) process.stdout.write(`${w.id}  ${w.type === 'personal' ? '(personal)' : '(team)   '}  ${w.name}\n`)
  })

ws.command('create <name>')
  .description('Create a new team workspace')
  .action(async (name: string) => {
    const { workspace } = await api()
      .createWorkspace(name)
      .catch((e: ApiError) => fail(e.code, e.message))
    if (program.opts().json) return void process.stdout.write(JSON.stringify(workspace) + '\n')
    process.stdout.write(`Created workspace "${workspace.name}" (${workspace.id})\n`)
  })

program
  .command('push [path]')
  .description('Merge local edits back to the doc (server-side 3-way merge)')
  .option('-m, --message <msg>', 'commit message describing the change')
  .action(async (path: string | undefined, opts: { message?: string }) => {
    const entries = listEntries()
    const entry = path ? findByPath(path) : entries.length === 1 ? entries[0] : undefined
    if (!entry) {
      fail(path ? 'stale_manifest' : 'usage', path ? `${path} isn't a pulled doc. Run \`mdocs pull\` first.` : 'Specify a path (multiple or zero docs linked here).')
    }
    const content = readFileSync(entry.path, 'utf8')
    const res = await api()
      .push(entry.docId, { baseVersion: Number(entry.baseVersion), content, message: opts.message })
      .catch((e: ApiError) => {
        if (e.code === 'patch_conflict')
          fail('patch_conflict', 'Conflict with current head — run `mdocs pull` to get the latest, re-apply your change, and push again.')
        fail(e.code, e.message)
      })
    setEntry({ ...entry, baseVersion: res.version.n, baseHash: res.version.contentHash }, content)
    if (program.opts().json) return void process.stdout.write(JSON.stringify({ version: res.version.n }) + '\n')
    process.stdout.write(`Pushed ${entry.path} (version ${res.version.n})\n`)
  })

program
  .command('new <path>')
  .description('Create a new doc from a local file and push its contents')
  .option('-w, --workspace <id>', 'workspace to create it in (default: personal)')
  .option('-t, --title <title>', 'doc title (default: first heading or filename)')
  .action(async (path: string, opts: { workspace?: string; title?: string }) => {
    const { server } = resolve(program.opts())
    const content = readFileSync(path, 'utf8')
    const title =
      opts.title ?? content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(path).replace(/\.md$/, '')
    const client = api()
    const { doc } = await client.createDoc(title, opts.workspace).catch((e: ApiError) => fail(e.code, e.message))
    const res = await client
      .push(doc.id, { baseVersion: 0, content, message: 'create' })
      .catch((e: ApiError) => fail(e.code, e.message))
    setEntry({ docId: doc.id, path, server, baseVersion: res.version.n, baseHash: res.version.contentHash }, content)
    if (program.opts().json) return void process.stdout.write(JSON.stringify({ docId: doc.id, version: res.version.n }) + '\n')
    process.stdout.write(`Created "${title}" (${doc.id}) and pushed ${path}\n`)
  })

program
  .command('history <doc>')
  .alias('log')
  .description('Show a document’s version history')
  .action(async (docId: string) => {
    const { versions } = await api()
      .history(docId)
      .catch((e: ApiError) => fail(e.code, e.message))
    if (program.opts().json) return void process.stdout.write(JSON.stringify(versions) + '\n')
    for (const v of versions) {
      const who = v.authorEmail ?? (v.source === 'cli-pull' ? '—' : v.source)
      process.stdout.write(`v${v.n}\t${new Date(v.createdAt).toLocaleString()}\t${who}\t${v.message ?? v.source}\n`)
    }
  })

program
  .command('revert <doc> <version>')
  .description('Restore a previous version as a new version (non-destructive)')
  .option('-m, --message <msg>', 'commit message')
  .action(async (docId: string, version: string, opts: { message?: string }) => {
    const res = await api()
      .revert(docId, Number(version), opts.message)
      .catch((e: ApiError) => fail(e.code, e.message))
    if (program.opts().json) return void process.stdout.write(JSON.stringify({ version: res.version.n }) + '\n')
    process.stdout.write(`Reverted to v${version} → new version ${res.version.n}\n`)
  })

const skills = program.command('skills').description('Install the mdocs agent skill (Claude + Codex)')
skills
  .command('install')
  .description('Install the mdocs skill so coding agents discover it')
  .action(() => {
    const targets = [
      { name: 'Claude', base: join(homedir(), '.claude') },
      { name: 'Codex', base: join(homedir(), '.codex') },
    ]
    let installed = 0
    for (const t of targets) {
      if (!existsSync(t.base)) {
        process.stdout.write(`–  ${t.name}: not found (skipped)\n`)
        continue
      }
      const dir = join(t.base, 'skills', 'mdocs')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'SKILL.md'), SKILL_MD)
      installed++
      process.stdout.write(`✓  ${t.name}: ${join(dir, 'SKILL.md')}\n`)
    }
    process.stdout.write(
      installed > 0
        ? `\nDone. Agents will now discover mdocs and use \`mdocs instructions\`.\n`
        : `\nNo agent config dirs found (~/.claude, ~/.codex).\n`,
    )
  })

program
  .command('update')
  .description('Update the mdocs CLI to the latest published version')
  .action(() => {
    const child = spawn('npm', ['i', '-g', '@thedataco/mdocs@latest'], { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('exit', (code) => process.exit(code ?? 0))
  })

program.parseAsync().catch((e) => fail(e.code ?? 'generic', e.message ?? String(e)))
