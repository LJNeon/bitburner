import {
	MONEY_PER_HACK, FAILURE_COLOR, WARNING_COLOR, SUCCESS_COLOR
} from "utility/constants.js";
import {SleepPids} from "utility/generic.js";
import {GetWeakThreads, GetGrowThreads, GetHackThreads} from "utility/metrics.js";
import RunScript from "utility/run-script.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const [target, pct = MONEY_PER_HACK] = ns.args;

	try {
		ns.getServer(target);
	}catch{
		return ns.tprint(`${FAILURE_COLOR}Server "${target}" doesn't exist.`);
	}

	while(true) {
		const server = ns.getServer(target);
		const player = ns.getPlayer();

		if(server.hackDifficulty !== server.minDifficulty) {
			const threads = GetWeakThreads(server.hackDifficulty - server.minDifficulty);
			const pids = RunScript(ns, "weaken.js", target, threads, true, true);

			ns.print(`${WARNING_COLOR}[?] Weakening "${target}"...`);
			await SleepPids(ns, pids);
		}else if(server.moneyAvailable !== server.moneyMax) {
			const threads = GetGrowThreads(ns, server, player);
			const pids = RunScript(ns, "grow.js", target, threads, true, true);

			ns.print(`${WARNING_COLOR}[?] Growing "${target}"...`);
			await SleepPids(ns, pids);
		}else{
			const threads = GetHackThreads(ns, server, player, pct);
			const pids = RunScript(ns, "hack.js", target, threads, true, true);

			ns.print(`${SUCCESS_COLOR}[!] Hacking "${target}" for ${Math.floor(pct * 100)}%...`);
			await SleepPids(ns, pids);
		}
	}
}