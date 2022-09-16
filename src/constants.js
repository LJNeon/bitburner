// RAM usage of weaken.js and grow.js
export const WEAKEN_GROW_RAM = 1.75;
// RAM usage of hack.js
export const HACK_RAM = 1.7;
// Security cost/gain for one thread based on task.
export const SEC_PER_THREAD = {
	// Security gain for a weaken thread.
	WEAKEN: 0.05,
	// Security cost for a grow thread.
	GROW: 0.004,
	// Security cost for a hack thread.
	HACK: 0.002
};
// Percentange of extra threads to add to weaken.js and grow.js to lessen desyncs.
export const WEAKEN_GROW_EXTRA = 1.1;
// GBs of home server RAM to consider unusable by scripts.
export const MIN_HOME_RAM = 45;
// Percentage of RAM to share with current faction on personal servers.
export const PERSONAL_SERVER_SHARE = 0.25;
// Percent of a server's total money to take in a single hack.
export const MONEY_PER_HACK = 0.5;
// Time in milliseconds to wait between batcher steps.
export const SAFETY_DELAY = 150;
// Time in milliseconds where a batcher step is "too late" and the batch is cancelled.
export const SAFETY_THRESHOLD = 25;
// Range in hacking skill levels that should be handled before the batcher needs to restart.
export const HACK_LEVEL_RANGE = 20;
// Time in milliseconds after which the targets list should be updated.
export const TARGET_UPDATE_RATE = 300000;
// GBs of total RAM across all accessible servers where small servers lose priority for scripts.
export const FOCUS_SMALL_THRESHOLD = 10_000;
// Default color to use when logging.
export const DEFAULT_COLOR = "\u001b[38;5;250m";
// List of colors to use when logging batches.
export const CONSOLE_COLORS = [
	"\u001b[38;5;203m", "\u001b[38;5;215m", "\u001b[38;5;185m", "\u001b[38;5;78m",
	"\u001b[38;5;116m", "\u001b[38;5;33m", "\u001b[38;5;141m"
];