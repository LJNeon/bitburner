import {TAIL_COLORS, DEFAULT_COLOR} from "constants.js";
import {SleepPids} from "utility.js";
import RunScript from "batcher/run-script.js";
import {GetWeakThreads, GetGrowThreads} from "batcher/threads.js";

/** @param {import("../").NS} ns */
async function Prepare(ns, target) {
	let server;
	let already = true;

	while((server = ns.getServer(target)).hackDifficulty !== server.minDifficulty
			|| server.moneyAvailable !== server.moneyMax) {
		const {hackDifficulty, minDifficulty, moneyAvailable, moneyMax} = server;
		const pids = [];

		if(already) {
			already = false;
			ns.print(`${DEFAULT_COLOR}[-] Preparing server...`);
		}

		if(hackDifficulty !== minDifficulty) {
			const threads = GetWeakThreads(hackDifficulty - minDifficulty);

			ns.print(`${DEFAULT_COLOR}[!] Difficulty at ${hackDifficulty.toFixed(2)}/${minDifficulty.toFixed(2)}`);
			pids.push(...RunScript(ns, "weaken.js", target, threads, true, true));
		}

		if(moneyAvailable !== moneyMax) {
			const threads = GetGrowThreads(ns, server, ns.getPlayer());

			ns.print(`${DEFAULT_COLOR}[!] Cash at ${ns.nFormat(moneyAvailable, "$0.00a")}/${ns.nFormat(moneyMax, "$0.00a")}`);
			pids.push(...RunScript(ns, "grow.js", target, threads, false, true));
		}

		if(pids.length === 0)
			throw Error("Not enough RAM to spawn a single thread!");

		await SleepPids(ns, pids);
	}

	if(!already)
		ns.print(`${DEFAULT_COLOR}[-] Server prepared.`);
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const target = ns.args[0];
	let batches = 0;

	try {
		ns.getServer(target);
	}catch{
		return ns.tprint(`Server "${target}" doesn't exist.`);
	}

	while(true) {
		await Prepare(ns, target);

		const pids = RunScript(ns, "grow.js", target, Number.MAX_SAFE_INTEGER, true, true);

		if(pids.length === 0)
			throw Error("Not enough RAM to spawn a single thread!");

		ns.print(`${TAIL_COLORS[batches++ % TAIL_COLORS.length]}Growing server for XP..`);
		await SleepPids(ns, pids);
	}
}