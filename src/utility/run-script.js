import {WEAKEN_GROW_RAM, HACK_RAM, SPREAD_THRESHOLD} from "utility/constants.js";
import RAM from "utility/ram.js";

export function FindScriptRAM(ns, ram, script, threads, spread, partial) {
	const threadRAM = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const homeBonus = 1 + ((ns.getServer("home").cpuCores - 1) / 16);
	const servers = [];
	let spawned = 0;

	if(homeBonus !== 1 && script === "grow.js") {
		const {free, reserved} = ram.GetServer("home");
		const spawn = Math.ceil(threads / homeBonus);

		if(free - reserved >= threads * threadRAM) {
			servers.push({hostname: "home", threads: spawn});
			ram.Reserve("home", spawn * threadRAM);
			spawned += threads;

			if(!spread)
				return servers;
		}
	}

	let list = ram.chunkList
		.map(({hostname, free, reserved}) => ({hostname, threads: Math.floor((free - reserved) / threadRAM)}))
		.filter(s => s.threads > 0);

	if(script === "weaken.js")
		list.sort((a, b) => a.threads - b.threads);
	else
		list.sort((a, b) => b.threads - a.threads);

	if(list.length === 0) {
		return servers;
	}else if(!partial && list.reduce((c, s) => c + s.threads, 0) < threads) {
		return servers;
	}else if(!spread) {
		const server = list.find(s => s.threads >= threads);

		if(server == null) {
			if(partial)
				list = [script === "weaken.js" ? list[list.length - 1] : list[0]];
			else
				return servers;
		}else{
			list = [server];
		}
	}

	for(const server of servers) {
		const spawn = Math.min(server.threads, threads - spawned);
		const amount = server.hostname === "home" ? Math.ceil(spawn / homeBonus) : spawn;

		servers.push({hostname: server.hostname, threads: amount});
		ram.Reserve(server.hostname, amount * threadRAM);
		spawned += spawn;

		if(spawned >= threads)
			break;
	}

	return servers;
}
/** @param {import("../").NS} ns */
export default function RunScript(ns, script, target, threads, spread = false, partial = false, ...args) {
	const ram = new RAM(ns);

	if(spread && script === "weaken.js" && ram.free - ram.reserved >= SPREAD_THRESHOLD)
		spread = false;

	const servers = FindScriptRAM(ns, ram, script, threads, spread, partial);
	const pids = [];

	for(const server of servers) {
		const pid = ns.exec(script, server.hostname, server.threads, target, ...args, Math.random().toString(16).slice(2));

		if(pid === 0) {
			pids.forEach(id => ns.kill(id));

			throw Error("Failed to execute script!");
		}

		pids.push(pid);
	}

	return pids;
}