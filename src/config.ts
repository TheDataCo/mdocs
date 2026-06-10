import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const DEFAULT_SERVER = 'https://mdocs.datacompany.dev'

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
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8'))
  } catch {
    return { server: DEFAULT_SERVER }
  }
}

export function saveConfig(config: Config): void {
  const p = configPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(config, null, 2))
  try {
    chmodSync(p, 0o600) // best-effort; no-op on platforms without POSIX perms
  } catch {
    /* ignore */
  }
}

/** Resolve server + token with precedence: env > flag-injected config > saved config. */
export function resolve(opts: { server?: string } = {}): { server: string; token?: string } {
  const cfg = loadConfig()
  return {
    server: process.env.MDOCS_SERVER || opts.server || cfg.server || DEFAULT_SERVER,
    token: process.env.MDOCS_TOKEN || cfg.token,
  }
}
