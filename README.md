# mdocs

CLI for [**mdocs** — Docs for Markdown](https://mdocs.datacompany.dev). Auth, list,
and pull collaborative markdown docs from the terminal — built so agents and devs
are first-class collaborators alongside humans editing live in the browser.

```sh
npm i -g @thedataco/mdocs        # published package; the command is `mdocs`
# or install the latest from source:
npm i -g github:TheDataCo/mdocs
```

## Usage

```sh
mdocs auth login                  # log in via the website (device authorization)
mdocs whoami                      # who am I
mdocs ws                          # list workspaces (ids)
mdocs ls                          # list accessible docs
mdocs pull <doc-id>               # write a doc to ./<title>.md and link it
mdocs push [path] -m "why"        # merge local edits back (server-side 3-way merge)
mdocs new <file.md> -w <ws-id>    # create a doc from a file in a workspace
mdocs instructions                # full guide for agents/LLMs
```

Push does a server-side 3-way merge against the version you pulled, applies it to
the live doc (humans see it instantly), and records a version with your message.
Conflicting overlaps exit `7` — re-pull, re-apply, push again. `mdocs revert` is
coming next.

## Auth

`mdocs auth login` opens the website, you confirm a short code, and the CLI
receives a scoped token (stored in `~/.config/mdocs/config.json`, `0600`). For
headless/CI use, set `MDOCS_TOKEN` (generate one in the app) and `MDOCS_SERVER`.

## Exit codes

`0` ok · `2` usage · `3` auth · `4` permission · `5` not found · `6` stale manifest ·
`7` conflict · `8` network · `9` server. `--json` for machine-readable output.

## License

MIT
