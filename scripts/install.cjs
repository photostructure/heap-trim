#!/usr/bin/env node

/**
 * Install script: on glibc Linux, runs node-gyp-build, which loads a prebuild
 * or compiles the addon from source. Everywhere else it does nothing.
 *
 * node-gyp-build is resolved through require.resolve and run with this
 * process's own interpreter, rather than spawned as `npx node-gyp-build`.
 *
 * An outer `npm install -g` exports npm_config_global=true, and a nested npx
 * inherits it. npx then treats its own bootstrap directory as a global
 * install, never writes $npm_config_cache/_npx/<hash>/package.json, and fails
 * reading the file it did not write -- exit 254 on POSIX, 127 on Windows.
 * Resolving the binary here re-enters neither npm nor the shell, so nothing in
 * npm's lifecycle environment can redirect it.
 */

const { spawnSync } = require("node:child_process");

// src/index.ts loads the addon only on glibc, and only glibc has prebuilds, so
// building it anywhere else would compile a file nothing loads.
if (process.report.getReport().header.glibcVersionRuntime == null) {
  process.exit(0);
}

// No env: option, so the child inherits process.env.
const result = spawnSync(
  process.execPath,
  [require.resolve("node-gyp-build/bin.js")],
  { stdio: "inherit" },
);

if (result.error) {
  console.error("Failed to run node-gyp-build:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`node-gyp-build exited with code ${result.status}`);
  process.exit(result.status ?? 1);
}
