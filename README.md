# @photostructure/heap-trim

Returns free C heap pages to the operating system from Node.js. Built for and supported by [PhotoStructure](https://photostructure.com).

[![npm version](https://img.shields.io/npm/v/@photostructure/heap-trim.svg)](https://www.npmjs.com/package/@photostructure/heap-trim)
[![Build](https://github.com/photostructure/heap-trim/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/photostructure/heap-trim/actions/workflows/build.yml)
[![Node-API v9 Badge](https://raw.githubusercontent.com/nodejs/abi-stable-node/refs/heads/doc/assets/Node-API%20v9%20Badge.svg)](https://nodejs.org/dist/latest/docs/api/n-api.html#node-api-version-matrix)
[![View on GitHub](https://img.shields.io/badge/View%20on-GitHub-blue)](https://github.com/photostructure/heap-trim)

## Quick start

```bash
npm install @photostructure/heap-trim
```

```typescript
import { heapTrim } from "@photostructure/heap-trim";

// After a burst of native work has freed its memory, while the process is idle:
heapTrim();
```

## `heapTrim(): boolean`

glibc's `free()` shrinks the heap only from its top, so pages freed below a
live allocation stay in the process's RSS. Native addons such as SQLite,
image decoders, and `Buffer` backing stores allocate from that heap.
`heapTrim()` calls glibc's `malloc_trim(0)`, which releases those free pages in
every malloc arena.

It locks each arena while it walks it, so call it when the process is idle,
not after every request.

**Returns:** `true` if glibc found whole free pages and told the kernel to drop
them. That doesn't mean RSS fell: glibc doesn't check whether those pages were
still resident, so repeated calls keep returning `true`. `false` if it found
none, or the process doesn't use glibc.

The function is on both the named and the default export, from CommonJS and
ESM.

## Supported platforms

| Platform      | Architecture | Node.js | What `heapTrim()` does   |
| ------------- | ------------ | ------- | ------------------------ |
| Linux (glibc) | x64, arm64   | 22+     | Calls `malloc_trim(0)`   |
| Linux (musl)  | x64, arm64   | 22+     | Nothing; returns `false` |
| macOS         | x64, arm64   | 22+     | Nothing; returns `false` |
| Windows       | x64, arm64   | 22+     | Nothing; returns `false` |

The package ships a native addon only for glibc Linux, which requires GLIBC
2.31+ (Debian 11+, Ubuntu 20.04+). On musl, macOS, and Windows it builds and
loads no native code.

musl has no trim call. On macOS and Windows the allocators have one, but in
the test this package uses (128 MiB of 64 KiB `Buffer`s freed below a live
one), neither released anything:

- On macOS 27.2 (arm64), `malloc_zone_pressure_relief(NULL, 0)` returned 0
  bytes, and the physical footprint stayed at 145 MB after the call.
- On Windows 11 (x64), the heap had already decommitted the freed pages before
  any call, and `_heapmin()` changed private bytes by 0.1 MB.

## Documentation

- [Security reporting](./SECURITY.md) - How to report security issues
- [API Reference](https://photostructure.github.io/heap-trim/modules.html)
- [Releasing](./doc/RELEASING.md) - How a release is built, staged, and approved

## Development

Development of this library was assisted by AI coding tools. All changes are human-reviewed and tested.
