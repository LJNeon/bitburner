import {NS} from "@ns";
import {Color, Task} from "/utility/enums";
import {GetWeakThreads, GetGrowThreads, GetXPServer} from "utility/metrics";
import {SleepPids, nFormat, GenID} from "utility/misc";
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
			pids.push(...RunScript(ns, Task.Weak1, threads, true, true, hostname, GenID()));
		}else if(moneyAvailable !== moneyMax) {
			const threads = GetGrowThreads(ns, server, ns.getPlayer());

			ns.print(`${Color.Warn}[?] Cash at $${nFormat(moneyAvailable)}/$${nFormat(moneyMax)}`);
			pids.push(...RunScript(ns, Task.Grow, threads, false, true, hostname, GenID()));
		}

		await SleepPids(ns, pids);
	}

	if(!already)
		ns.print(`${Color.Success}[-] Server prepared.`);
}

export async function main(ns: NS) {
	ns.disableLog("ALL");

	const target = GetXPServer(ns).unwrapOr(false);
	let pids: number[] = [];

	if(target === false)
		return ns.tprint(`${Color.Default}No hackable servers found.`);

	while(true) {
		await Prepare(ns, target);
		pids = RunScript(ns, Task.Grow, Number.MAX_SAFE_INTEGER, true, true, target, GenID());
		await SleepPids(ns, pids);
	}
}