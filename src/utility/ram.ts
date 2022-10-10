import {NS} from "@ns";
import {MIN_HOME_RAM, PERSONAL_SERVER_SHARE} from "utility/constants";
import {ScanAll} from "utility/misc";

interface Chunk {
	hostname: string;
	used: number;
	free: number;
	total: number;
	reserved: number;
	bought: boolean;
}

export default class RAM {
	chunks: Chunk[] = [];
	used = 0;
	free = 0;
	reserved = 0;
	total = 0;

	constructor(ns: NS, simulateMax = false) {
		const servers = ScanAll(ns).map(n => ns.getServer(n)).filter(s => s.hasAdminRights && s.maxRam > 0);

		for(const server of servers) {
			if(server.hostname.startsWith("hacknet"))
				continue;

			const used = simulateMax ? 0 : server.ramUsed;
			const free = server.maxRam - used;
			let reserved = 0;

			if(server.hostname === "home")
				reserved += MIN_HOME_RAM;
			else if(server.purchasedByPlayer && (simulateMax || ns.getRunningScript("share.js", server.hostname) == null))
				reserved += server.maxRam * PERSONAL_SERVER_SHARE;

			this.used += used;
			this.free += free;
			this.reserved += reserved;
			this.total += server.maxRam;

			if(free >= 0) {
				this.chunks.push({
					hostname: server.hostname,
					used,
					free,
					total: server.maxRam,
					reserved,
					bought: server.purchasedByPlayer
				});
			}
		}

		this.chunks.sort((a, b) => {
			if(a.hostname === "home")
				return 1;
			else if(b.hostname === "home")
				return -1;
			else if(a.free !== b.free)
				return a.free - b.free;

			return a.bought === b.bought ? 0 : a.bought ? -1 : 1;
		});
	}

	get chunkList() {
		return this.chunks.slice();
	}

	GetServer(hostname: string) {
		return this.chunks.find(c => c.hostname === hostname);
	}

	Reserve(hostname: string, size: number) {
		const match = this.GetServer(hostname);

		if(match == null || match.free - match.reserved < size)
			return false;

		match.reserved += size;
		this.reserved += size;

		return true;
	}

	Smallest(min = 0) {
		let hostname;
		let size = 0;

		for(const chunk of this.chunks) {
			const free = chunk.free - chunk.reserved;

			if((hostname == null || free < size) && free >= min) {
				hostname = chunk.hostname;
				size = free;
			}
		}

		return hostname == null ? null : {hostname, size};
	}

	Largest() {
		let hostname;
		let size = 0;

		for(const chunk of this.chunks) {
			const free = chunk.free - chunk.reserved;

			if(hostname == null || free > size) {
				hostname = chunk.hostname;
				size = free;
			}
		}

		return hostname == null ? null : {hostname, size};
	}
}