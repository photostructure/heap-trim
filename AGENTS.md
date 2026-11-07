# AGENTS.md

Shared instructions for every coding agent in this repo. `CLAUDE.md` imports
this file, so Claude Code and Codex read the same rules.

## Project Overview

@photostructure/heap-trim - Native Node.js module with one function,
`heapTrim()`, that asks the C allocator to return free heap pages to the
operating system. It calls `malloc_trim(0)` on glibc Linux and does nothing
elsewhere. The addon is built, shipped, and loaded only on glibc Linux; on
musl, macOS, and Windows `src/index.ts` exports a function that returns
`false`, and the install script builds nothing. `src/index.ts` records the
macOS and Windows measurements that decided that.

### Directory Structure

- `src/` - Source code (TypeScript and C++)
- `dist/` - Compiled JavaScript output (gitignored)
- `doc/` - Static documentation (manually written, checked into git)
- `build/` - All build artifacts (gitignored)
  - `build/docs/` - Generated API documentation from TypeDoc (deployed to GitHub Pages)
- `scripts/` - Build and utility scripts
- `prebuilds/` - Prebuilt glibc Linux x64 and arm64 binaries

### Before a release

`make preflight` (or `npm run preflight`, which runs `scripts/preflight.ts`):
updates dependencies, formats, lints, builds native + dist, and runs the tests.

### Script Preferences

**Always** use TypeScript (`.ts`) scripts executed with `tsx` instead of:

- `.js` scripts (require compilation or older Node.js syntax)
- `.mjs` scripts (ESM-only, compatibility issues)
- `.cjs` scripts (CommonJS-only, less type safety)

## Critical Knowledge

### Testing heapTrim()

`src/heap-trim.test.ts` measures memory in a spawned child process, because
Jest's own allocations share the heap and change how much glibc keeps. The
child calls `globalThis.gc()` twice under `--expose-gc`: V8 frees `Buffer`
backing stores on a background thread after a full GC, and the second `gc()`
waits for the first one's frees. That `gc()` is part of the measurement, not a
fix for an async test.

The RSS test is skipped when `LD_PRELOAD` is set, because a preloaded
allocator (ASan in `scripts/sanitizers-test.sh`, jemalloc, tcmalloc) serves
`malloc()` instead of glibc.

### Cross-Module Compatibility

Use `_dirname()` from `./dirname` instead of `__dirname` - works in both CommonJS and ESM contexts.

### Node.js Version Compatibility

Jest 30 doesn't support Node.js 23. Use Node.js 22, 24, or 26.

## Native Build Hardening

`binding.gyp` carries the OpenSSF-based flag matrix from
`@photostructure/fs-metadata`. Its comments explain each flag. The traps:

- **`-Werror=format-security` hard-errors without `-Wformat`** — the two must stay paired
  (`-Wformat=2` supplies it).
- **On macOS, gyp ignores `cflags`/`cflags_cc`** — only `xcode_settings` reaches the compiler.
  And `OTHER_CPLUSPLUSFLAGS` must keep `"$(inherited)"`, or the C++ TUs lose every
  `OTHER_CFLAGS` hardening flag.
- **`_FORTIFY_SOURCE` must be OFF under ASan.** `binding.gyp` keys this off the
  `HEAP_TRIM_SANITIZE` env var; `scripts/sanitizers-test.sh` sets it.
- **`_FORTIFY_SOURCE=3` silently degrades to level 2** on our Bullseye/GCC 10.2 floor, so `=2`
  is intentional.
- **Sanitizer suppressions must never match first-party frames.** Keep
  `.lsan-suppressions.txt` rules function-specific.

## Memory Checks

Run `npm run check:memory`:

- **Linux**: AddressSanitizer/LeakSanitizer/UndefinedBehaviorSanitizer over the Jest suite (`scripts/sanitizers-test.sh`, needs clang)
- **Everywhere else**: nothing, because no native code loads there

## CI/CD Test Reliability

### Critical Anti-Patterns

**Never** use these to "fix" async issues:

```javascript
// BAD: Arbitrary timeouts
await new Promise((resolve) => setTimeout(resolve, 100));
// BAD: Forcing GC
if (global.gc) global.gc();
// BAD: setImmediate in afterAll
afterAll(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});
```

### Windows Directory Cleanup

Always use retry logic:

```typescript
await fsp.rm(tempDir, {
  recursive: true,
  force: true,
  maxRetries: process.platform === "win32" ? 3 : 1,
  retryDelay: process.platform === "win32" ? 100 : 0,
});
```

### Platform Performance Multipliers

- Alpine Linux (musl): 2x slower
- ARM64 emulation: 5x slower
- Windows processes: 4x slower
- macOS VMs: 4x slower

## Release Process

Releases use npm Trusted Publishing and staged approval. GitHub Actions must
have access to these organization-level signing secrets:

- `SSH_SIGNING_KEY`: SSH private signing key
- `GIT_USER_NAME`: release commit author name
- `GIT_USER_EMAIL`: release commit author email

Do not create or move a release tag manually. Do not run `npm publish` from a
workstation; the one exception is the one-time `npm stage publish` bootstrap
in "The first release" in `doc/RELEASING.md`. To release:

1. Write the release notes in `CHANGELOG.md` under a heading that names the
   version bump: `## [Unreleased (patch)]`, `## [Unreleased (minor)]`, or
   `## [Unreleased (major)]`.
2. Run the **Build & Prepare Release** workflow on `main`. It takes no input.
3. Wait for `publish.yaml` to validate, build, test, and stage the exact tag.
4. Inspect the staged package on npm and approve it with 2FA. The
   **Create immutable GitHub release** job in `publish.yaml` waits for that
   approval, then creates the GitHub release with the version's `CHANGELOG.md`
   section above GitHub's generated notes.

See `doc/RELEASING.md` for the complete procedure and failure recovery.

## General guidance

Never do inline imports like `const { mkdirSync } = await import("node:fs");` -- just use standard imports.

**NEVER** add "Generated with" or "Co-Authored-By" agent lines to git commit messages. Keep commits clean and professional.
