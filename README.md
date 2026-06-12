# mdocs

The CLI for [**mdocs** — Docs for Markdown](https://mdocs.datacompany.dev), the
open-source, real-time Markdown editor from
[The Data Company](https://datacompany.dev). The same document, live in your
browser and your terminal: collaborate like Google Docs; pull, edit, and push
from the command line like git. Built so agents and developers are first-class
collaborators alongside humans editing live in the browser.

## Get started

```sh
npm i -g @thedataco/mdocs   # 1. install (command is `mdocs`)
mdocs auth login            # 2. log in via the website (device authorization)
mdocs skills install        # 3. teach your coding agents to use mdocs
```

Step 3 drops a small skill into `~/.claude/skills` and `~/.codex/skills` so
Claude Code and Codex automatically discover mdocs and know to run
`mdocs instructions` for the full machine-readable guide.

To install the latest from source instead: `npm i -g github:TheDataCo/mdocs`.

## Documents

```sh
mdocs ls                          # list accessible docs, grouped by workspace
mdocs cat <doc-id>                # print a doc's markdown (read without pulling)
mdocs pull <doc-id> [path]        # write a doc to a local .md file and link it
mdocs push [path] -m "why"        # merge local edits back (server-side 3-way merge)
mdocs new <file.md> -w <ws-id>    # create a doc from a file in a workspace
```

`push` three-way merges your edits against the version you pulled, applies the
result to the live document (collaborators in the browser see it instantly),
and records a version with your message. Conflicting overlaps exit `7` —
re-pull, re-apply, push again. Like git, without the ceremony.

## History

```sh
mdocs history <doc-id>            # version history: who, when, and why
mdocs pull <doc-id> --rev <n>     # inspect a historical version (read-only)
mdocs revert <doc-id> <version>   # restore a version as a NEW version (non-destructive)
```

## Comments

Comments are the task channel between humans and agents: people leave them in
the browser, agents pick them up from the terminal — and vice versa.

```sh
mdocs comments <doc-id>           # list open comments (--all includes resolved)
mdocs comments add <doc-id> "Confirm the refund window." --as "Claude"
mdocs comments resolve <doc-id> <comment-id>
```

Comments posted from the CLI are signed as the token owner's agent —
`--as "Claude"` shows up in the editor as **Claude (you@example.com's agent)**.
The attribution is applied server-side, so an agent can never pass itself off
as a person.

## Sharing & workspaces

```sh
mdocs share <doc-id> <email>      # share with a person (--role viewer|editor)
mdocs share <doc-id> --link       # mint a shareable live link
mdocs ws                          # list workspaces (ids for `new -w`)
mdocs ws create "Team name"       # create a team workspace
```

No per-seat pricing — invite collaborators without counting chairs.

## Recently deleted

Deleted docs and workspaces are recoverable for 15 days on Free and 90 days on
Pro.

```sh
mdocs trash                       # list recently deleted docs and workspaces
mdocs trash cat <doc-id>          # read a deleted doc's markdown
mdocs trash restore <id>          # restore a doc or workspace
```

Restoring a workspace also restores the docs that were deleted with it.

## Account & maintenance

```sh
mdocs whoami                      # who am I
mdocs auth login | logout         # device-auth in, credentials out
mdocs update                      # self-update to the latest published version
mdocs instructions                # complete guide for agents/LLMs (llm.txt style)
```

## Auth

`mdocs auth login` opens the website, you confirm a short code, and the CLI
receives a scoped token (stored in `~/.config/mdocs/config.json`, mode `0600`).
For headless and CI use — including agents — generate a token in the app and
set `MDOCS_TOKEN` and `MDOCS_SERVER` instead.

## Exit codes & JSON

Stable for agents and CI: `0` ok · `2` usage · `3` auth · `4` permission ·
`5` not found · `6` stale manifest · `7` conflict · `8` network · `9` server.
Pass `--json` for machine-readable output.

## Releasing

One-time setup — create a **granular access token** at npmjs.com (Access Tokens →
Generate → Granular; Read **and write** for the `@thedataco` scope; enable
**bypass 2FA**), then store it (never committed):

```sh
npm config set //registry.npmjs.org/:_authToken <TOKEN>
```

Then every release is one command (bumps the version, builds, publishes, tags):

```sh
npm run release          # patch (0.2.8 → 0.2.9)
npm run release:minor    # minor (0.2.9 → 0.3.0)
```

Requires a clean git tree. With the bypass-2FA token, publish runs without an
OTP prompt.

## License

MIT — the mdocs app (server, web, core) is AGPL-3.0 and free to self-host.
