import {MIN_HOME_RAM} from "utility/constants.js";
import {ScanAll} from "utility/generic.js";

export default class RAM {
	/** @param {import("../").NS} ns */
	constructor(ns, simulateMax = false) {
		/** @type {import("../").Server[]} */
		const servers = ScanAll(ns).map(n => ns.getServer(n)).filter(s => s.hasAdminRights && s.maxRam > 0);

		this.chunks = [];
		this.used = 0;
		this.free = 0;
		this.reserved = 0;
		this.total = 0;

		for(const server of servers) {
			if(server.hostname.startsWith("hacknet"))
				continue;

			const used = simulateMax ? 0 : server.ramUsed;
			const free = server.maxRam - used;
			const reserved = server.hostname === "home" ? MIN_HOME_RAM : 0;

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
		return this.chunks;
	}

	Reserve(hostname, size) {
		const match = this.chunks.find(c => c.hostname === hostname);

		if(match == null || match.free - match.used >= size)
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