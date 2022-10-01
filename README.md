# LJ's Bitburner Scripts

## cct/complete.js

A script that finds and completes all available coding contracts.

## hacking/batch.js <target> [debug = false]

A HWGW non-sequential JIT batcher with clock-sync and stalefish delays.

## hacking/xp.js

A script that fills up all available RAM with grow calls for maximum XP/sec.

## tools/best-target.js

A script that determines the most profitable servers to hack and the best server to spam for XP.

## tools/buy-server.js

A script that buys and upgrades personal servers until they're all maxed, and shares a portion of each personal server's ram with the current faction/company.

## tools/gain-root.js

A script that gains root access to every possible server depending on programs owned.

## tools/update-share.js

A script that shares on personal servers again as necessary, usually useful after you're forced to reload and kill all scripts.

# TODO!

 * Fix batcher failing to detect when a task is killed by another script.
 * Improve batcher handling of desynced and late tasks.
 * Improve batcher logging to only re-print when something has changed instead of every tick.
 * Remove unused methods and constants.