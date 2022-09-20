import {WEAKEN_GROW_RAM, HACK_RAM, FOCUS_SMALL_THRESHOLD} from "constants.js";
import RAM from "batcher/ram.js";

/** @param {import("../").NS} ns */
export default function RunScript(ns, script, target, threadCount, partial = false) {
	const ram = new RAM(ns);
	const threadRam = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const spread = script === "weaken.js";
	let hosts = {};
	let hosted = 0;

	while(hosted < threadCount) {
		const {server, size} = ram.free <= FOCUS_SMALL_THRESHOLD ? ram.Smallest(threadRam * threadCount) : ram.Largest();
		let threads = Math.floor(size / threadRam);

		if(threads === 0)
			break;
		else if(threads > threadCount - hosted)
			threads = threadCount - hosted;

		ram.Reserve(server, size);
		hosts[server] = threads;
		hosted += threads;

		if(hosted >= threadCount)
			break;
	}

	if(!partial && hosted !== threadCount) {
		return [];
	}else if(!spread && Object.keys(hosts).length > 1) {
		if(partial) {
			let largest;

			for(const host in hosts) {
				if(largest == null || hosts[host] > largest.threads)
					largest = {host, threads: hosts[host]};
			}

			hosts = {[largest.host]: largest.threads};
		}else{
			return [];
		}
	}

	const pids = [];

	for(const host in hosts)
		pids.push(ns.exec(script, host, hosts[host], target, Math.random().toString(16).slice(-8)));

	return pids;
}