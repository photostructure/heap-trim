import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { execPath } from "node:process";
import { _dirname } from "./dirname";
import { isGlibc } from "./test-utils/platform";

const projectRoot = join(_dirname(), "..");
const installScript = join(projectRoot, "scripts", "install.cjs");

// Off glibc, src/index.ts never loads the addon, so the install script must not
// build one. A package directory with binding.gyp and no prebuild is what
// sends node-gyp-build to node-gyp.
(isGlibc ? describe.skip : describe)("install lifecycle off glibc", () => {
  let packageRoot: string;

  beforeEach(() => {
    packageRoot = mkdtempSync(join(tmpdir(), "heap-trim install-"));
    mkdirSync(join(packageRoot, "src"));
    for (const file of ["package.json", "binding.gyp", "src/binding.cpp"]) {
      copyFileSync(join(projectRoot, file), join(packageRoot, file));
    }
  });

  afterEach(() => {
    rmSync(packageRoot, { recursive: true, force: true });
  });

  it("exits 0 without building the native addon", () => {
    const result = spawnSync(execPath, [installScript], {
      cwd: packageRoot,
      encoding: "utf8",
      timeout: 30_000,
    });

    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: "",
    });
    expect(existsSync(join(packageRoot, "build"))).toBe(false);
  });
});

// A private PATH can expose Node without npm/npx using a symlink on POSIX.
(isGlibc ? describe : describe.skip)("install lifecycle", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "heap-trim install-"));
    symlinkSync(execPath, join(tempRoot, "node"));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("loads the native module under a global install without npm or npx", () => {
    const cache = join(tempRoot, "cold-cache");
    const result = spawnSync(execPath, [installScript], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        npm_config_global: "true",
        npm_config_cache: cache,
        npm_config_offline: "true",
        // node-gyp-build probes the real native binary via its test command.
        // npm lifecycle scripts include this bin directory on PATH too.
        PATH: [join(projectRoot, "node_modules", ".bin"), tempRoot].join(
          delimiter,
        ),
      },
    });

    if (result.status !== 0) {
      throw new Error(
        `Install failed (${result.status}): ${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
      );
    }

    expect({
      error: result.error,
      status: result.status,
      stderr: result.stderr,
      stdout: result.stdout,
    }).toEqual({
      error: undefined,
      status: 0,
      stderr: expect.not.stringContaining("DEP0190"),
      stdout: expect.any(String),
    });
    expect(existsSync(join(cache, "_npx"))).toBe(false);
  });
});
