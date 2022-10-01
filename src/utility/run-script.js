import {WEAKEN_GROW_RAM, HACK_RAM, SPREAD_THRESHOLD} from "utility/constants.js";
import RAM from "utility/ram.js";

/** @param {import("../").NS} ns */
export function FindScriptRAM(ns, ram, script, threads, spread = false, partial = false) {
	const threadRAM = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const homeBonus = 1 + ((ns.getServer("home").cpuCores - 1) / 16);

	if(spread && script === "weaken.js" && ram.free - ram.reserved >= SPREAD_THRESHOLD)
		spread = false;

	if(homeBonus !== 1 && script === "grow.js") {
		const {free, reserved} = ram.GetServer("home");
		const spawn = Math.ceil(threads / homeBonus);

		if(free - reserved >= threadRAM * threads) {
			ram.Reserve("home", spawn * threadRAM);

			return [{hostname: "home", threads: spawn}];
		}
	}

	const hosts = [];
	let spawned = 0;
	let servers = ram.chunkList
		.map(({hostname, free, reserved}) => ({hostname, threads: Math.floor((free - reserved) / threadRAM)}))
		.filter(s => s.threads > 0);

	if(script === "weaken.js")
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
				servers = [script === "weaken.js" ? servers[servers.length - 1] : servers[0]];
			else
				return [];
		}else{
			servers = [server];
		}
	}

	for(const server of servers) {
		const spawn = Math.min(server.threads, threads - spawned);
		const amount = server.hostname === "home" ? Math.ceil(spawn / homeBonus) : spawn;

		hosts.push({hostname: server.hostname, threads: amount});
		ram.Reserve(server.hostname, amount * threadRAM);
		spawned += spawn;

		if(spawned >= threads)
			break;
	}

	return hosts;
}
/** @param {import("../").NS} ns */
export function RunScript(ns, script, target, threads, spread = false, partial = false, ...args) {
	const ram = new RAM(ns);
	const hosts = FindScriptRAM(ns, ram, script, threads, spread, partial);
	const pids = [];

	for(const server of hosts) {
		const pid = ns.exec(script, server.hostname, server.threads, target, ...args, Math.random().toString(16).slice(2));

		if(pid === 0) {
			pids.forEach(id => ns.kill(id));

			throw Error("Failed to execute script!");
		}

		pids.push(pid);
	}

	return pids;
}