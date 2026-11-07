#!/usr/bin/env node

/**
 * Cross-platform memory checking script - Central orchestrator for all memory tests
 *
 * This script handles all platform-specific memory testing:
 * - ASan/LSan/UBSan tests on Linux
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for output
const colors = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  RESET: "\x1b[0m",
} as const;

// Use colors only if not on Windows
const isWindows = os.platform() === "win32";
const color = (colorCode: string, text: string): string =>
  isWindows ? text : `${colorCode}${text}${colors.RESET}`;

console.log(color(colors.BLUE, "=== Memory Leak Detection Suite ==="));

let exitCode = 0;

// 1. Run platform-specific native memory tests
const platform = os.platform();

if (platform === "linux") {
  // Run AddressSanitizer, LeakSanitizer and UndefinedBehaviorSanitizer
  console.log(
    color(
      colors.YELLOW,
      "\nRunning AddressSanitizer, LeakSanitizer and UBSan tests...",
    ),
  );
  try {
    const asanScript = path.join(__dirname, "sanitizers-test.sh");
    if (!existsSync(asanScript) || !asanScript.startsWith(__dirname)) {
      throw new Error(`Invalid script path: ${asanScript}`);
    }

    execFileSync("bash", [asanScript], { stdio: "inherit", shell: false });
    console.log(
      color(colors.GREEN, "✓ AddressSanitizer, LeakSanitizer and UBSan passed"),
    );
  } catch (error) {
    console.log(
      color(colors.RED, "✗ AddressSanitizer, LeakSanitizer or UBSan failed"),
    );
    if (error instanceof Error) {
      console.log(color(colors.RED, `  Error: ${error.message}`));
    }
    exitCode = 1;
  }
} else {
  console.log(
    color(colors.YELLOW, `\nNo native memory checks exist for ${platform}.`),
  );
  process.exit(0);
}

// 2. Report results
if (exitCode === 0) {
  console.log(
    color(colors.GREEN, "\n=== All memory tests completed successfully! ==="),
  );
} else {
  console.log(
    color(colors.RED, "\n=== Memory tests failed! See output above. ==="),
  );
}

process.exit(exitCode);
