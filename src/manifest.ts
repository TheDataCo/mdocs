import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Local link state lives in ./.mdocs (gitignored). Keyed by docId (not path),
// so renames/copies don't corrupt it. Base content is stored in its own file,
// not inline in the manifest.
const DIR = '.mdocs'
const MANIFEST = join(DIR, 'manifest.json')

export interface DocEntry {
  docId: string
  path: string
  server: string
  baseVersion: number
  baseHash: string
}

interface Manifest {
  docs: Record<string, DocEntry>
}

function read(): Manifest {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'))
  } catch {
    return { docs: {} }
  }
}

function write(m: Manifest): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2))
}

export function getEntry(docId: string): DocEntry | undefined {
  return read().docs[docId]
}

export function findByPath(path: string): DocEntry | undefined {
  return Object.values(read().docs).find((d) => d.path === path)
}

export function setEntry(entry: DocEntry, baseContent: string): void {
  const m = read()
  m.docs[entry.docId] = entry
  mkdirSync(join(DIR, 'base'), { recursive: true })
  writeFileSync(join(DIR, 'base', `${entry.docId}.md`), baseContent)
  write(m)
}

export function getBase(docId: string): string | undefined {
  const p = join(DIR, 'base', `${docId}.md`)
  return existsSync(p) ? readFileSync(p, 'utf8') : undefined
}
