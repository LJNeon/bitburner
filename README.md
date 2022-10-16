# LJ's Bitburner Scripts

## Tools used:
- [VSCode](https://code.visualstudio.com/)
- [pnpm](https://pnpm.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [bitburner-filesync](https://www.npmjs.com/package/bitburner-filesync/)

## How to use
- Build true-myth for use in the repository: `pnpm true-myth`.
- Start the watcher: `pnpm watch`.
- Your code is now in-game and can be edited live from VSCode!

## Scripts
- `cct/complete.js` Finds and completes all available coding contracts.
- `hacking/batch.js <target> [debug = false]` A HWGW clock-synced JIT batcher with stalefish delays.
- `hacking/xp.js` Fills up all available RAM with grow calls for maximum XP/sec.
- `tools/best-target.js` Determines the most profitable servers for both money and XP.
- `tools/buy-server.js` Buys and upgrades personal servers until they're all maxed, sharing part of each one's ram in the process.
- `tools/gain-root.js` Gains root access to every possible server with programs owned.
- `tools/update-share.js` Shares personal server RAM as necessary, usually used after killing all scripts.