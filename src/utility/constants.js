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
// Scripts to copy to every server.
export const TASK_SCRIPTS = ["weaken.js", "grow.js", "hack.js"];
// Scripts to run by task ID.
export const SCRIPTS_BY_ID = ["weaken.js", "weaken.js", "grow.js", "hack.js"];
// Programs that can open a port.
export const PORT_PROGRAMS = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
// Security cost/gain for one thread based on task.
export const SEC_PER_THREAD = {
	// Security gain for a weaken thread.
	WEAKEN: 0.05,
	// Security cost for a grow thread.
	GROW: 0.004,
	// Security cost for a hack thread.
	HACK: 0.002
};
// GBs of home server RAM to consider unusable by scripts.
export const MIN_HOME_RAM = 45;
// Percentage of RAM to share with current faction on personal servers.
export const PERSONAL_SERVER_SHARE = 0.25;
// Percent of a server's total money to take in a single hack.
export const MONEY_PER_HACK = 0.5;
// Time in milliseconds to wait between batcher tasks.
export const JOB_SPACER = 100;
// Time in milliseconds where a batch task is "too late", causing the hack and sometimes grow to be cancelled.
export const SAFETY_THRESHOLD = 50;
// Range in hacking skill levels that should be handled before the batcher needs to restart.
export const HACK_LEVEL_RANGE = 15;
// GBs of total RAM across all accessible servers where spreading threads should be disabled.
export const SPREAD_THRESHOLD = 10_000;
// Viable percents of a server's total money to hack in a single pass.
export const LEECH_PERCENTS = [
	0.01, 0.02, 0.03, 0.04, 0.05, 0.1, 0.15, 0.2, 0.25,
	0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1
];
// Port number for batches and their executed tasks to use.
export const BATCH_PORT = 1;
// List of colors to use when logging.
export const COLORS = {
	DEFAULT: "\u001b[38;5;250m",
	INFO: "\u001b[38;5;116m",
	SUCCESS: "\u001b[38;5;78m",
	WARN: "\u001b[38;5;185m",
	FAIL: "\u001b[38;5;203m",
};
// Abbreviations to use when formatting normal numbers.
export const NORM_ABBRS = [
	"", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n", "d",
	"Ud", "Dd", "Td", "QaD", "QiD", "SxD", "SpD", "OcD", "NoD", "Vg"
];
// Abbreviations to use when formatting an amount of bytes.
export const BYTE_ABBRS = ["b", "kB", "GB", "TB", "PB", "EB", "ZB", "YB"];