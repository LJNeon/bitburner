import {WEAKEN_GROW_RAM, HACK_RAM, FOCUS_SMALL_THRESHOLD} from "constants.js";
import RAM from "batcher/ram.js";

/** @param {import("../").NS} ns */
export default function RunScript(ns, script, target, threads, spread = false, partial = false) {
	const threadRAM = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const ram = new RAM(ns);
	let servers = ram.chunkList
		.map(({server, free, reserved}) => ({name: server, threads: Math.floor((free - reserved) / threadRAM)}))
		.filter(s => s.threads > 0);

	if(ram.free - ram.reserved >= FOCUS_SMALL_THRESHOLD)
		servers.sort((a, b) => b.threads - a.threads);
	else
		servers.sort((a, b) => a.threads - b.threads);

	if(servers.length === 0) {
		return [];
	}else if(!partial && servers.reduce((c, s) => c + s.threads, 0) < threads) {
		return [];
	}else if(!spread) {
		const server = servers.find(s => s.threads >= threads);

		if(server == null) {
			if(partial)
				servers = [servers[servers.length - 1]];
			else
				return [];
		}else{
			servers = [server];
		}
	}

	const pids = [];
	let spawned = 0;

	for(const server of servers) {
		const spawn = Math.min(server.threads, threads - spawned);
		const pid = ns.exec(script, server.name, spawn, target, Math.random().toString(16).slice(2));

		if(pid === 0)
			throw Error("Failed to execute script!");

		pids.push(pid);
		spawned += spawn;

		if(spawned >= threads)
			break;
	}

	return pids;
}