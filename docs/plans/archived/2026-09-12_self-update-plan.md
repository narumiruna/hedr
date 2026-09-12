# herdr-web self-update plan

## Goal

Add `herdr-web update` so the npm-installed CLI can replace its global installation with the latest published `herdr-web` release without starting Herdr or the workbench.

## Context

The documented installation path is `npm install --global herdr-web`. The CLI currently accepts only an optional project directory, so `update` is treated as a directory name.

## Non-Goals

- Updating Herdr itself.
- Supporting package managers other than the documented npm installation.
- Background or automatic updates.

## Plan

- [x] Add an `update` command path in `scripts/herdr-web.mjs` that runs `npm install --global herdr-web@latest`, propagates failures, and works with the existing Windows npm executable handling. Evidence: `npm test -- tests/cli.test.ts` passes.
- [x] Extend `tests/cli.test.ts` for successful updates, update failures, and help output. Evidence: all 12 focused CLI tests pass.
- [x] Document `herdr-web update` and its npm-global scope in `README.md`. Evidence: `node scripts/herdr-web.mjs --help` exposes `update` without invoking external commands.
- [x] Run repository CI checks with `npm run ci`. Evidence: Biome checked 132 files, package inspection passed, 309 tests passed, TypeScript and Vite builds passed, and font assets passed.

## Risks

- npm may reject a global install because of host permissions; the command must report the failure and must not claim success.
- An npm-linked development checkout is still a global npm link; updating replaces it with the published package, so documentation must describe the command as updating the global installation.

## Completion Checklist

- [x] `herdr-web update` invokes only the npm global update and exits successfully when npm succeeds.
- [x] npm update failures produce a non-zero exit and a clear herdr-web error.
- [x] Existing directory startup and help behavior remain covered by tests.
- [x] Formatting, tests, package checks, and builds pass.
