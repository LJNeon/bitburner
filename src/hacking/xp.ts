import {NS} from "@ns";
import {JOB_SPACER} from "utility/constants";
import {Color} from "/utility/enums";
import {GetWeakThreads, GetGrowThreads, BestXPServer} from "utility/metrics";
import {SleepPids, nFormat} from "utility/misc";
import {RunScript} from "utility/run-script";

async function Prepare(ns: NS, hostname: string) {
	let server;
	let already = true;

	while((server = ns.getServer(hostname)).hackDifficulty !== server.minDifficulty
			|| server.moneyAvailable !== server.moneyMax) {
		const {hackDifficulty, minDifficulty, moneyAvailable, moneyMax} = server;
		const pids = [];

		if(already)
			already = false;

		if(hackDifficulty !== minDifficulty) {
			const threads = GetWeakThreads(hackDifficulty - minDifficulty);

			ns.print(`${Color.Warn}[?] Difficulty at ${hackDifficulty.toFixed(2)}/${minDifficulty.toFixed(2)}`);
			pids.push(...RunScript(ns, "weaken.js", hostname, threads, true, true));
		}else if(moneyAvailable !== moneyMax) {
			const threads = GetGrowThreads(ns, server, ns.getPlayer());

			ns.print(`${Color.Warn}[?] Cash at $${nFormat(moneyAvailable)}/$${nFormat(moneyMax)}`);
			pids.push(...RunScript(ns, "grow.js", hostname, threads, false, true));
		}

		if(pids.length === 0)
			throw Error("Not enough RAM to spawn a single thread!");

		await SleepPids(ns, pids);
	}

	if(!already)
		ns.print(`${Color.Success}[-] Server prepared.`);
}

export async function main(ns: NS) {
	ns.disableLog("ALL");

	const target = BestXPServer(ns);

	if(target == null)
		return ns.tprint(`${Color.Default}No hackable servers found.`);

	while(true) {
		await Prepare(ns, target);

		const pids = RunScript(ns, "grow.js", target, Number.MAX_SAFE_INTEGER, true, true);

		if(pids.length === 0)
			return ns.print(`${Color.Default}Not enough RAM to spawn a single thread!`);

		await SleepPids(ns, pids);
		await ns.sleep(JOB_SPACER * 2);
	}
}