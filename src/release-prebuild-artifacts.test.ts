import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  expectedPrebuildPath,
  prebuildifyArgs,
  prebuildTargets,
  verifyPrebuilds,
} from "./release-prebuild-artifacts";

describe("release prebuild artifacts", () => {
  const packageName = "@photostructure/heap-trim";
  let tempRoot: string;

  async function populatePrebuilds(projectRoot: string): Promise<void> {
    for (const target of prebuildTargets) {
      const file = join(projectRoot, expectedPrebuildPath(packageName, target));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(
        file,
        `binary:${target.platform}-${target.architecture}-${target.libc}`,
      );
    }
  }

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "heap-trim-release-test-"));
  });

  afterEach(async () => {
    await rm(tempRoot, {
      recursive: true,
      force: true,
      maxRetries: process.platform === "win32" ? 3 : 1,
      retryDelay: process.platform === "win32" ? 100 : 0,
    });
  });

  test("uses the prebuildify package filenames for every release target", () => {
    expect(
      prebuildTargets.map((target) =>
        expectedPrebuildPath(packageName, target),
      ),
    ).toEqual([
      "prebuilds/linux-x64/@photostructure+heap-trim.glibc.node",
      "prebuilds/linux-arm64/@photostructure+heap-trim.glibc.node",
    ]);
  });

  test("tags libc in the build flags exactly where the expected filename does", () => {
    for (const target of prebuildTargets) {
      const args = prebuildifyArgs(target);
      const file = expectedPrebuildPath(packageName, target);
      expect([
        `${target.platform}-${target.architecture}-${target.libc}`,
        args.includes("--tag-libc"),
      ]).toEqual([
        `${target.platform}-${target.architecture}-${target.libc}`,
        /\.(?:glibc|musl)\.node$/.test(file),
      ]);
      expect(args).toEqual(
        expect.arrayContaining([
          "--napi",
          "--strip",
          "--arch",
          target.architecture,
          "--platform",
          target.platform,
        ]),
      );
    }
  });

  test("accepts exactly the two expected prebuilds", async () => {
    const projectRoot = join(tempRoot, "project");
    await populatePrebuilds(projectRoot);

    await expect(
      verifyPrebuilds({ projectRoot, packageName }),
    ).resolves.toEqual(
      prebuildTargets
        .map((target) => expectedPrebuildPath(packageName, target))
        .sort(),
    );
  });

  test("names a missing target in the error", async () => {
    const projectRoot = join(tempRoot, "project");
    await populatePrebuilds(projectRoot);
    const missing = expectedPrebuildPath(packageName, prebuildTargets[0]);
    await rm(join(projectRoot, missing));

    await expect(verifyPrebuilds({ projectRoot, packageName })).rejects.toThrow(
      `Missing: ${missing}`,
    );
  });

  test("rejects an unexpected file", async () => {
    const projectRoot = join(tempRoot, "project");
    await populatePrebuilds(projectRoot);
    const unexpected = "prebuilds/linux-x64/unexpected.txt";
    await writeFile(join(projectRoot, unexpected), "unexpected");

    await expect(verifyPrebuilds({ projectRoot, packageName })).rejects.toThrow(
      `Unexpected: ${unexpected}`,
    );
  });

  test("rejects an absent prebuild directory", async () => {
    const projectRoot = join(tempRoot, "project");
    await mkdir(projectRoot);

    await expect(verifyPrebuilds({ projectRoot, packageName })).rejects.toThrow(
      /Prebuild directory .*prebuilds does not exist/,
    );
  });
});
