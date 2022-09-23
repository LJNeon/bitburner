import {WEAKEN_GROW_RAM, HACK_RAM, FOCUS_SMALL_THRESHOLD} from "utility/constants.js";
import RAM from "utility/ram.js";

/** @param {import("../").NS} ns */
export default function RunScript(ns, script, target, threads, spread = false, partial = false, ...args) {
	const threadRAM = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const ram = new RAM(ns);
	const focusSmall = ram.free - ram.reserved < FOCUS_SMALL_THRESHOLD;
	let servers = ram.chunkList
		.map(({hostname, free, reserved}) => ({hostname, threads: Math.floor((free - reserved) / threadRAM)}))
		.filter(s => s.threads > 0);

	if(focusSmall)
		servers.sort((a, b) => a.threads - b.threads);
	else
		servers.sort((a, b) => b.threads - a.threads);

	if(servers.length === 0) {
		return [];
	}else if(!partial && servers.reduce((c, s) => c + s.threads, 0) < threads) {
		return [];
	}else if(!spread) {
		const server = servers.find(s => s.threads >= threads);

		if(server == null) {
			if(partial)
				servers = [servers[focusSmall ? servers.length - 1 : 0]];
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
		const pid = ns.exec(script, server.hostname, spawn, target, ...args, Math.random().toString(16).slice(2));

		if(pid === 0) {
			pids.forEach(id => ns.kill(id));

			throw Error("Failed to execute script!");
		}

		pids.push(pid);
		spawned += spawn;

		if(spawned >= threads)
			break;
	}

	return pids;
}