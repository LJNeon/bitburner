import {WEAKEN_GROW_RAM, HACK_RAM} from "constants.js";
import RAM from "batcher/ram.js";

/** @param {import("../").NS} ns */
export default function RunScript(ns, script, target, threads, partial = false) {
	const threadRAM = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const spread = script === "weaken.js";
	const ram = new RAM(ns);
	let servers = ram.chunkList
		.map(({name, free, reserved}) => ({name, threads: Math.floor((free - reserved) / threadRAM)}))
		.filter(s => s.threads > 0);

	servers.sort((a, b) => a.threads - b.threads);

	if(servers.length === 0) {
		return null;
	}else if(!partial && servers.reduce((c, s) => c + s.threads, 0) < threads) {
		return null;
	}else if(!spread) {
		const server = servers.find(s => s.threads >= threads);

		if(server == null) {
			if(partial)
				servers = [servers[servers.length - 1]];
			else
				return null;
		}else{
			servers = [server];
		}
	}

	const pids = [];
	let spawned = 0;

	for(const server of servers) {
		const spawn = Math.min(server.threads, threads - spawned);

		pids.push(ns.exec(script, server.name, spawn, target, Math.random().toString(16).slice(-8)));
		spawned += spawn;
	}

	return pids;
}