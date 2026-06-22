// The agent skill installed by `mdocs skills install` into Claude and Codex.
// The `description` is the discovery trigger; the body points at `mdocs
// instructions` for the authoritative command guide (so this stays short and
// never goes stale). Avoids inline backticks so it's safe in a template literal.
export const SKILL_MD = `---
name: mdocs
description: Use when the user wants to read, edit, create, review, or collaborate on shared markdown documents via mdocs ("Docs for Markdown") — e.g. "pull/push an mdocs doc", "update the spec in mdocs", reviewing a doc on mdocs.datacompany.dev, or any task run inside a directory that contains a .mdocs/ folder. mdocs documents are live-collaborative markdown that humans edit in a browser; the mdocs CLI lets an agent list, pull, edit, push (3-way merged), and view the history of those docs from the terminal.
---

# mdocs — collaborative markdown docs from the CLI

mdocs is "Google Docs for markdown": documents are live-collaborative markdown
that humans edit in a browser while agents edit them through the "mdocs" CLI.
Edits you push are 3-way merged into the live document and recorded as versions
with your commit message, so humans can see what you changed and why.

## When to use this
- The user asks to read, edit, create, or review a shared markdown / "mdocs" doc.
- You are working in a directory that contains a .mdocs/ folder (docs linked here).
- The user references mdocs.datacompany.dev, or an mdocs doc/workspace.

## First, get the full guide
The CLI ships its own complete, machine-readable guide. Run this once and follow
it — it lists every command, flag, JSON shape, and exit code:

    mdocs instructions

## The usual loop

    mdocs ls --json                   # find a doc id
    mdocs pull <id> doc.md --json     # write the markdown locally + link it
    # ...edit doc.md...
    mdocs push doc.md --message "why" # 3-way merge back; re-pull if it conflicts

Other commands: mdocs ws (list/create workspaces), mdocs new (create a doc from a
file), mdocs convert (AI-convert raw output → markdown, e.g. "cmd | mdocs convert
-o notes.md"), mdocs history / revert, mdocs favorites (star/list docs), mdocs whoami.

## Auth
- Headless/agent: set MDOCS_TOKEN (a user generates it) and optionally MDOCS_SERVER.
- Interactive: run "mdocs auth login".
- If the CLI is missing: npm i -g @thedataco/mdocs
`
