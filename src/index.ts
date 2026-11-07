import nodeGypBuild from "node-gyp-build";
import { join } from "node:path";
import { _dirname } from "./dirname";

/** The functions the native addon exports. */
export interface HeapTrimModule {
  /** @see {@link heapTrim} */
  heapTrim(): boolean;
}

// The addon is built and loaded only on glibc, because only glibc's trim call
// released memory. Each of these measurements allocated 128 MiB as Buffer
// backing stores, kept only the last one, collected the rest, then trimmed:
//
// - macOS: malloc_zone_pressure_relief(nullptr, 0) returned 0 bytes. On m1
//   (macOS 27.2, arm64, Node 24.22.1) with 64 KiB buffers, the physical
//   footprint went from 14 MB to 144 MB, stayed at 145 MB after the frees
//   (vmmap: 124 MB of "Malloc Small (empty)" regions), and stayed at 145 MB
//   after the call. With 1, 4, 16, 32, 128, 256 and 1024 KiB buffers it also
//   returned 0 and the footprint did not change.
// - Windows: _heapmin() returned 0 (success), which does not say whether it
//   released anything. On swift (Windows 11, x64, Node 24.21.0) with 64 KiB
//   buffers, the heap had already decommitted the freed pages: private bytes
//   went from 20 MB to 151 MB and fell to 23 MB after the frees, and the call
//   changed them by 0.1 MB. With 1 KiB buffers, 84 MB of private bytes stayed
//   committed after the frees, and the call left 84 MB.
// - musl has no trim call.
const isGlibc =
  (process.report.getReport() as { header: { glibcVersionRuntime?: string } })
    .header.glibcVersionRuntime != null;

// Use _dirname() helper that works in both CJS/ESM and Jest
const binding: HeapTrimModule = isGlibc
  ? (nodeGypBuild(join(_dirname(), "..")) as HeapTrimModule)
  : { heapTrim: () => false };

/**
 * Returns free C heap memory to the operating system.
 *
 * glibc's `free()` shrinks the heap only from its top, so pages freed below a
 * live allocation stay in the process's RSS. On glibc Linux this calls
 * `malloc_trim(0)`, which releases those free pages in every malloc arena. On
 * musl, macOS, and Windows it does nothing: musl has no trim call, and
 * macOS's `malloc_zone_pressure_relief()` and Windows' `_heapmin()` released
 * no measurable memory in this package's test, so it doesn't call them.
 *
 * It locks each arena while it walks it, so call it when the process is idle,
 * not after every request.
 *
 * @returns `true` if glibc found whole free pages and told the kernel to drop
 * them. That doesn't mean RSS fell: glibc doesn't check whether those pages
 * were still resident, so repeated calls keep returning `true`. `false` if it
 * found none, or the process doesn't use glibc.
 *
 * @example
 * ```typescript
 * import { heapTrim } from "@photostructure/heap-trim";
 *
 * heapTrim();
 * ```
 */
export const heapTrim: () => boolean = binding.heapTrim;

// Default export for CommonJS compatibility
export default binding;
