# Contributing to the mdocs CLI

Thanks for your interest in the mdocs CLI — the terminal client for
[mdocs.datacompany.dev](https://mdocs.datacompany.dev), published as
[`@thedataco/mdocs`](https://www.npmjs.com/package/@thedataco/mdocs). This repo is
**MIT**; the [web app](https://github.com/TheDataCo/mdocs-web-editor) is
AGPL-3.0-only.

## Developer Certificate of Origin (sign-off required)

Every commit must be signed off. By signing off you certify the
[Developer Certificate of Origin](https://developercertificate.org/) — in short,
that you wrote the change (or have the right to submit it) and agree it can be
distributed under this project's license.

Add the sign-off automatically with `-s`:

```sh
git commit -s -m "your message"
```

This appends a `Signed-off-by: Your Name <you@example.com>` trailer (the name and
email must be real and match your Git identity). PRs with unsigned commits can't
be merged.

## Development setup

Requirements: Node ≥ 18, pnpm ≥ 10.

```sh
pnpm install
pnpm dev -- --help            # run the CLI from source (tsx)
pnpm build                    # bundle to dist/ (tsup)
```

Point the CLI at a local server while developing:

```sh
node dist/cli.js --server http://localhost:3001 ls
# or, for an agent/CI token:
MDOCS_SERVER=http://localhost:3001 MDOCS_TOKEN=dd_… node dist/cli.js ls
```

## Before you open a PR

CI runs these on every push and pull request; run them locally first:

```sh
pnpm lint                     # Biome
pnpm typecheck                # tsc --noEmit
pnpm build                    # must bundle cleanly
```

Sanity-check the bundle:

```sh
node dist/cli.js --version
node dist/cli.js --help
node dist/cli.js instructions
```

## Conventions

- The CLI is **agent-friendly first**: keep `--json` output stable, preserve the
  documented [exit codes](README.md#exit-codes--json), and update
  `src/instructions.ts` (the `mdocs instructions` guide) whenever you add or
  change a command.
- Match the surrounding code's style — Biome handles linting.
- Keep comments focused on the *why*, not the *what*.
- One logical change per PR; write a clear description of the problem and the fix.

## Releasing (maintainers)

```sh
npm run release          # patch
npm run release:minor    # minor
```

Requires a clean git tree and an npm token with write access to the
`@thedataco` scope.

## License

By contributing, you agree your contributions are licensed under **MIT**, the
same license as this project.
