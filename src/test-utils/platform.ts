// src/test-utils/platform.ts

/** Whether this process runs on glibc Linux, the only platform with the addon. */
export const isGlibc =
  (process.report.getReport() as { header: { glibcVersionRuntime?: string } })
    .header.glibcVersionRuntime != null;
