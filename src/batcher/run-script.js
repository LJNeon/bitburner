import {WEAKEN_GROW_RAM, HACK_RAM, FOCUS_SMALL_THRESHOLD} from "constants.js";
import {GenID} from "utility.js";
import {RAM} from "batcher/ram.js";

/** @param {import("../").NS} ns */
export function RunScript(ns, script, server, threadCount, partial = false) {
	const ram = new RAM(ns);
	const threadRam = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const spread = script === "weaken.js";
	const pids = [];
	let hosted = 0;

	while(hosted < threadCount) {
		const freeRam = ram.free <= FOCUS_SMALL_THRESHOLD ? ram.Smallest(threadRam * threadCount) : ram.Largest();
		let threads = Math.floor(freeRam / threadRam);

		if(threads === 0)
			break;
		else if(threads > threadCount - hosted)
			threads = threadCount - hosted;
		else if(!spread && threads !== threadCount)
			break;

		const host = ram.Reserve(freeRam);

		if(host == null)
			break;

		const pid = ns.exec(script, host, threads, server, GenID());

		if(pid !== 0) {
			pids.push(pid);
			hosted += threads;

			if(hosted >= threadCount)
				break;
		}
	}

	if(!partial && hosted < threadCount) {
		pids.forEach(pid => ns.kill(pid));

		return [];
	}

	return pids;
}