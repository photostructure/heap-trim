import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { _dirname } from "./dirname";
import heapTrimModule, { heapTrim } from "./index";
import { isGlibc } from "./test-utils/platform";
import { getTestTimeout } from "./test-utils/test-timeout-config";

// glibc's free() shrinks the heap only from its top, so pages freed below a
// live allocation stay resident. heapTrim() calls glibc's malloc_trim(0),
// which releases those pages.

// The heap-trim .node files this process has loaded: build/Release/heap_trim.node
// or prebuilds/linux-<arch>/@photostructure+heap-trim.glibc.node.
function loadedAddons(): string[] {
  return (
    process.report.getReport() as { sharedObjects: string[] }
  ).sharedObjects.filter((path) => /heap[_+-]trim[^/\\]*\.node$/.test(path));
}

// A preloaded allocator (ASan in scripts/sanitizers-test.sh, jemalloc,
// tcmalloc) serves malloc() instead of glibc, so glibc's malloc_trim() has
// nothing to release. libasan has no malloc_trim of its own.
const usesGlibcMalloc = isGlibc && !process.env["LD_PRELOAD"];

const projectRoot = join(_dirname(), "..");
const MiB = 1024 * 1024;

describe("heapTrim()", () => {
  it("returns a boolean from the named and default exports", () => {
    expect(typeof heapTrim()).toBe("boolean");
    expect(typeof heapTrimModule.heapTrim()).toBe("boolean");
  });

  (usesGlibcMalloc ? it : it.skip)(
    "returns pages freed below a live allocation to the OS on glibc",
    () => {
      // Jest's own allocations share the heap and change how much glibc keeps,
      // so this runs in a fresh process. It allocates 128 MiB as 64 KiB Buffer
      // backing stores, which are below glibc's 128 KiB mmap threshold and so
      // come from the heap, writes to every page, keeps only the last one, and
      // collects the rest. V8 frees backing stores on a background thread
      // after a full GC, and the second gc() waits for the first one's frees
      // to finish; with one gc(), the trim ran while frees were in flight and
      // RssAnon fell only from 139 to 56-76 MiB.
      //
      // On speedy (glibc 2.43, x64, Node 20, 22, 24, 25 and 26), RssAnon
      // stayed 129-130 MiB above the start after the frees, and heapTrim()
      // brought it back to within 1.0-1.4 MiB of the start.
      const script = `
        const { readFileSync } = require("node:fs");
        const { heapTrim } = require("node-gyp-build")(process.cwd());
        const rssAnon = () =>
          Number(/^RssAnon:\\s+(\\d+) kB$/m.exec(readFileSync("/proc/self/status", "utf8"))[1]) * 1024;
        const start = rssAnon();
        let buffers = [];
        for (let i = 0; i < ${128 * MiB} / ${64 * 1024}; i++) {
          buffers.push(Buffer.allocUnsafeSlow(${64 * 1024}).fill(1));
        }
        const live = buffers.at(-1);
        buffers = undefined;
        globalThis.gc();
        globalThis.gc();
        const freed = rssAnon();
        const trimmed = heapTrim();
        const after = rssAnon();
        process.stdout.write(JSON.stringify({ start, freed, trimmed, after, live: live.length }));
      `;
      const child = spawnSync(process.execPath, ["--expose-gc", "-e", script], {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: getTestTimeout(20000),
      });
      expect(child.stderr).toBe("");
      expect(child.status).toBe(0);
      const { start, freed, trimmed, after } = JSON.parse(child.stdout) as {
        start: number;
        freed: number;
        trimmed: boolean;
        after: number;
      };
      // Without the trim, after - start would be freed - start.
      expect(freed - start).toBeGreaterThan(32 * MiB);
      expect(trimmed).toBe(true);
      expect(after - start).toBeLessThan(32 * MiB);
    },
    getTestTimeout(30000),
  );

  (isGlibc ? it : it.skip)("loads the native addon on glibc", () => {
    expect(loadedAddons()).not.toEqual([]);
  });

  // musl, macOS, and Windows: see the measurements in src/index.ts.
  (isGlibc ? it.skip : it)(
    "returns false without loading the native addon off glibc",
    () => {
      expect(heapTrim()).toBe(false);
      expect(heapTrimModule.heapTrim()).toBe(false);
      expect(loadedAddons()).toEqual([]);
    },
  );
});
