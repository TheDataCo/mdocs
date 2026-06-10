// Full machine-readable guide for agents — printed by `mdocs instructions`.
// Keep this accurate to the implemented commands; an agent should be able to
// operate mdocs correctly from this text alone.
export const INSTRUCTIONS = `# mdocs CLI — agent instructions

mdocs is "Google Docs for markdown": documents are live-collaborative markdown.
Humans edit in a browser; you (an agent) operate via this CLI over the HTTP API.
This file tells you everything needed to use it. Output of read commands is
stable JSON when you pass --json. Exit codes are meaningful (see below).

## Setup / auth (do this first)
- Preferred for agents/CI: set environment variables (no interactive login):
    MDOCS_TOKEN=<token>      a dd_-prefixed API token (a human generates it in
                             the app: "CLI token" button, shown once)
    MDOCS_SERVER=<url>       optional; defaults to https://mdocs.datacompany.dev
- Interactive alternative: \`mdocs auth login\` (opens the website to approve a
  code, stores the token in ~/.config/mdocs/config.json). Not for headless use.
- Verify: \`mdocs whoami --json\` -> {"id","email","name"} or {"user":null}.

## Model (read this before pulling/pushing)
- A doc's canonical state is collaborative; its current markdown is its "content".
- Versions: meaningful checkpoints of a doc's content. A pull records the
  "base version" you started from. A future push will 3-way merge your edits
  against the latest version, so concurrent human edits are preserved.
- Every push carries a commit message explaining WHY; this + version history is
  how humans audit and (if needed) revert agent changes. Always write a clear
  --message when pushing.

## Commands
- mdocs ls [--json]
    List accessible docs. JSON: [{"id","title","workspaceId","createdAt","updatedAt"}]
- mdocs workspaces [--json]   (alias: ws; same as "ws list")
    List your workspaces with ids (for "new --workspace").
- mdocs ws create <name> [--json]
    Create a new team workspace. JSON: {"id","type","name","role"}.
- mdocs pull <doc-id> [path] [--force] [--json]
    Fetch a doc's current markdown to a local file (default ./<title-slug>.md),
    and link it in ./.mdocs/ (records the base version for a later push).
    JSON: {"path","version"}. Use --force to overwrite an existing file.
- mdocs push [path] [--message "why"] [--json]
    Merge local edits back. The server 3-way merges your file against current
    head using the version you pulled as the ancestor, applies it to the live
    doc (humans see it instantly), and records a version. On a conflicting
    overlap it exits 7 (patch_conflict) — re-run pull, re-apply, push again.
    ALWAYS pass --message describing the change. JSON: {"version"}.
- mdocs new <path> [--workspace <id>] [--title "…"] [--json]
    Create a new doc from a local file and push its contents. Without
    --workspace it goes to your personal workspace. Title defaults to the first
    "# heading" or the filename. JSON: {"docId","version"}.
- mdocs history <doc-id> [--json]   (alias: log)
    Show version history: each version's number, time, author, source, message.
    JSON: [{"n","createdAt","authorEmail","source","message","contentHash"}]
- mdocs pull <doc-id> <path> --rev <n>
    Write a specific historical version's markdown to a file (read-only; not
    linked/tracked). Use it to inspect or diff an old version.
- mdocs revert <doc-id> <version> [--message "…"]
    Restore a previous version's content as a NEW version (non-destructive —
    history is preserved; the live doc updates). Use after inspecting history.
- mdocs skills install
    Install the mdocs skill into Claude and Codex (~/.claude/skills, ~/.codex/skills)
    so coding agents auto-discover mdocs and know to run "mdocs instructions".
- mdocs update
    Update this CLI to the latest published version.
- mdocs whoami [--json]
- mdocs auth login | logout
- mdocs instructions
    Print this guide.

Global flags: --server <url>, --json.

## Typical agent workflow
1. export MDOCS_TOKEN=...; export MDOCS_SERVER=https://mdocs.datacompany.dev
2. mdocs ls --json                       # find the doc id you need
3. mdocs pull <id> doc.md --json         # get the markdown locally
4. edit doc.md                           # make your change
5. mdocs push doc.md --message "…"       # merge it back (re-pull if it conflicts)
To create a brand-new doc: run "mdocs ws" to find a workspace id, then
"mdocs new doc.md --workspace <id>" (create + push in one step).

## Exit codes
0 ok · 2 usage · 3 auth_failed · 4 permission_denied · 5 not_found ·
6 stale_manifest · 7 patch_conflict · 8 network · 9 server_error
On error, stderr has "mdocs: <message>"; with --json, errors are JSON where available.

## Notes
- Markdown is the source of truth; what you pull is exactly the doc's bytes.
- Do not invent commands; only those listed above exist in this version.
`
