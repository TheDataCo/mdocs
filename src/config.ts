import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const DEFAULT_SERVER = 'https://app.usemdocs.com'

// Hosts we've since moved off of. A saved config pointing at one of these is
// silently rewritten to DEFAULT_SERVER on load (see loadConfig), so devices
// that logged in before the move self-heal on their next command — `mdocs
// update` only swaps the npm package, it never rewrites config.
const LEGACY_SERVERS = new Set(['https://mdocs.datacompany.dev'])

interface Config {
  server: string
  token?: string
}

// XDG-ish config location; honor XDG_CONFIG_HOME if set.
function configPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'mdocs', 'config.json')
}

export function loadConfig(): Config {
  let cfg: Config
  try {
    cfg = JSON.parse(readFileSync(configPath(), 'utf8'))
  } catch {
    return { server: DEFAULT_SERVER }
  }
  // Migrate a saved config off a retired host, preserving the token.
  if (cfg.server && LEGACY_SERVERS.has(cfg.server)) {
    cfg.server = DEFAULT_SERVER
    try {
      saveConfig(cfg)
    } catch {
      /* read-only config — still return the migrated value in-memory */
    }
  }
  return cfg
}

export function saveConfig(config: Config): void {
  const p = configPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(config, null, 2), { mode: 0o600 })
  try {
    chmodSync(p, 0o600) // for pre-existing files; no-op on platforms without POSIX perms
  } catch {
    /* ignore */
  }
}

// The token is sent as a bearer header to whatever this resolves to, so an
// http:// server (except local dev) would leak it to the network.
function checkServerUrl(server: string): string {
  let u: URL
  try {
    u = new URL(server)
  } catch {
    process.stderr.write(`mdocs: invalid server URL ${JSON.stringify(server)} — expected e.g. https://app.usemdocs.com\n`)
    process.exit(2)
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1'
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    process.stderr.write(`mdocs: refusing non-HTTPS server ${server} (tokens would be sent in cleartext)\n`)
    process.exit(2)
  }
  return server
}

/** Resolve server + token with precedence: env > flag-injected config > saved config. */
export function resolve(opts: { server?: string } = {}): { server: string; token?: string } {
  const cfg = loadConfig()
  return {
    server: checkServerUrl(process.env.MDOCS_SERVER || opts.server || cfg.server || DEFAULT_SERVER),
    token: process.env.MDOCS_TOKEN || cfg.token,
  }
}
