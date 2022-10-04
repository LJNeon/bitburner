import {Task} from "utility/enums";

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
export const SCRIPTS_BY_TYPE = {
	[Task.Weak1]: "weaken.js",
	[Task.Weak2]: "weaken.js",
	[Task.Grow]: "grow.js",
	[Task.Hack]: "hack.js"
};
// The order tasks are expected to finish in.
export const TYPE_ORDER = [Task.Hack, Task.Weak1, Task.Grow, Task.Weak2];
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
export const MIN_HOME_RAM = 32;
// Percentage of RAM to share with current faction on personal servers.
export const PERSONAL_SERVER_SHARE = 0.25;
// Time in milliseconds to wait between batcher tasks.
export const JOB_SPACER = 75;
// Time in milliseconds where a task is "too late", causing the batch to be cancelled.
export const SAFE_THRESHOLD = 50;
// Range in hacking skill levels that should be handled before the batcher needs to restart.
export const HACK_LEVEL_RANGE = 15;
// GBs of total RAM across all accessible servers where spreading threads should be disabled.
export const SPREAD_THRESHOLD = 10_000;
// Viable percents of a server's total money to hack in a single pass.
export const LEECH_PERCENTS = [
	0.0100, 0.0290, 0.0541, 0.0842, 0.1187, 0.1571, 0.1991, 0.2445, 0.2930, 0.3445,
	0.3989, 0.4560, 0.5157, 0.5779, 0.6426, 0.7096, 0.7789, 0.8505, 0.9242, 1.0000
];
// Port number for batches and their executed tasks to use.
export const BATCH_PORT = 1;
// Abbreviations to use when formatting normal numbers.
export const NORM_ABBRS = ["", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n", "d"];
// Abbreviations to use when formatting an amount of bytes.
export const BYTE_ABBRS = ["b", "kB", "GB", "TB", "PB", "EB", "ZB", "YB"];