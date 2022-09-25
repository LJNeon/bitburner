import {
	SAFETY_DELAY, FAILURE_COLOR, WARNING_COLOR, SUCCESS_COLOR
} from "utility/constants.js";
import {SleepPids, nFormat} from "utility/generic.js";
import RunScript from "utility/run-script.js";
import {GetWeakThreads, GetGrowThreads} from "utility/threads.js";

/** @param {import("../").NS} ns */
async function Prepare(ns, target) {
	let server;
	let already = true;

	while((server = ns.getServer(target)).hackDifficulty !== server.minDifficulty
			|| server.moneyAvailable !== server.moneyMax) {
		const {hackDifficulty, minDifficulty, moneyAvailable, moneyMax} = server;
		const pids = [];

		if(already)
			already = false;

		if(hackDifficulty !== minDifficulty) {
			const threads = GetWeakThreads(hackDifficulty - minDifficulty);

			ns.print(`${WARNING_COLOR}[?] Difficulty at ${hackDifficulty.toFixed(2)}/${minDifficulty.toFixed(2)}`);
			pids.push(...RunScript(ns, "weaken.js", target, threads, true, true));
		}else if(moneyAvailable !== moneyMax) {
			const threads = GetGrowThreads(ns, server, ns.getPlayer());

			ns.print(`${WARNING_COLOR}[?] Cash at $${nFormat(moneyAvailable)}/$${nFormat(moneyMax)}`);
			pids.push(...RunScript(ns, "grow.js", target, threads, false, true));
		}

		if(pids.length === 0)
			throw Error("Not enough RAM to spawn a single thread!");

		await SleepPids(ns, pids);
	}

	if(!already)
		ns.print(`${SUCCESS_COLOR}[-] Server prepared.`);
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const target = ns.args[0];

	try {
		ns.getServer(target);
	}catch{
		return ns.tprint(`Server "${target}" doesn't exist.`);
	}

	while(true) {
		await Prepare(ns, target);

		const pids = RunScript(ns, "grow.js", target, Number.MAX_SAFE_INTEGER, true, true);

		if(pids.length === 0)
			return ns.print(`${FAILURE_COLOR}Not enough RAM to spawn a single thread!`);

		await SleepPids(ns, pids);
		await ns.sleep(SAFETY_DELAY * 2);
	}
}