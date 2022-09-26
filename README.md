# LJ's Bitburner Scripts

## hacking/batcher.js

A HWGW non-sequential JIT batcher with clock-sync and stalefish delays.

## hacking/simple.js

A manager script with rudimentary weaken and grow calculations.

## hacking/xp.js

A script that fills up all available RAM with grow calls for maximum XP/sec.

## tools/best-target.js

A script that determines the most profitable servers to hack.

## tools/buy-server.js

A script that buys and upgrades personal servers until they're all maxed, and shares a portion of each personal server's ram with the current faction/company.

## tools/complete-cct.js

A script that finds and completes all available coding contracts.

## tools/gain-root.js

A script that gains root access to every possible server depending on programs owned.

## tools/update-share.js

A script that shares on personal servers again as necessary, usually useful after you're forced to reload and kill all scripts.

# TODO!

 * Fix hacking/batcher.js sometimes failing to notice batches finished when available RAM is low.
 * Improve hacking/xp.js to automatically choose a target using `BestXPServer()`.
 * Remove unused methods and constants.