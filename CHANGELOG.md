# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
Added for new features.
Changed for changes in existing functionality.
Deprecated for soon-to-be removed features.
Removed for now removed features.
Fixed for any bug fixes.
Security in case of vulnerabilities.
-->

## [Unreleased (major)]

### Added

- **`heapTrim()`** returns free heap memory to the operating system on glibc Linux by calling `malloc_trim(0)`. glibc's `free()` shrinks the heap only from its top, so pages freed below a live allocation otherwise stay resident. On musl, macOS, and Windows it does nothing and returns `false`, and the package builds and loads no native code there: macOS's `malloc_zone_pressure_relief()` and Windows' `_heapmin()` released no measurable memory in the same test.
