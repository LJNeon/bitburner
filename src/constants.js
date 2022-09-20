// RAM usage of weaken.js and grow.js
export const WEAKEN_GROW_RAM = 1.75;
// RAM usage of hack.js
export const HACK_RAM = 1.7;
// IDs for each task in a single batch.
export const IDS = {
	W1: 0,
	W2: 1,
	G: 2,
	H: 3
};
// Security cost/gain for one thread based on task.
export const SEC_PER_THREAD = {
	// Security gain for a weaken thread.
	WEAKEN: 0.05,
	// Security cost for a grow thread.
	GROW: 0.004,
	// Security cost for a hack thread.
	HACK: 0.002
};
// Ratios of function durations in comparison to hack().
export const TIME_RATIOS = {
	WEAKEN: 4,
	GROW: 3.2
};
// Percentange of extra threads to add to weaken.js and grow.js to lessen desyncs.
export const WEAKEN_GROW_EXTRA = 1.1;
// GBs of home server RAM to consider unusable by scripts.
export const MIN_HOME_RAM = 45;
// Percentage of RAM to share with current faction on personal servers.
export const PERSONAL_SERVER_SHARE = 0.25;
// Percent of a server's total money to take in a single hack.
export const MONEY_PER_HACK = 0.5;
// Time in milliseconds to wait between batcher tasks.
export const SAFETY_DELAY = 150;
// Time in milliseconds where a batch task is "too late" and the batch is cancelled.
export const SAFETY_THRESHOLD = 25;
// Time in milliseconds after which the "simple" batcher should retry a batch.
export const RETRY_AFTER = [60_000, "60s"];
// Range in hacking skill levels that should be handled before the batcher needs to restart.
export const HACK_LEVEL_RANGE = 20;
// GBs of total RAM across all accessible servers where small servers should no longer be prioritized.
export const FOCUS_SMALL_THRESHOLD = 10_000;
// GBs of total RAM across all accessible servers where a chain batcher is considered viable.
export const CHAIN_VIABLE_THRESHOLD = 1_000_000;
// Default color to use when logging.
export const DEFAULT_COLOR = "\u001b[38;5;250m";
// List of colors to use when logging batches.
export const TAIL_COLORS = [
	"\u001b[38;5;203m", "\u001b[38;5;215m", "\u001b[38;5;185m", "\u001b[38;5;78m",
	"\u001b[38;5;116m", "\u001b[38;5;33m", "\u001b[38;5;141m"
];