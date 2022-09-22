import {MIN_HOME_RAM} from "utility/constants.js";
import {ScanAll} from "utility/generic.js";

export default class RAM {
	/** @param {import("../").NS} ns */
	constructor(ns, simulateMax = false) {
		const servers = ScanAll(ns).filter(s => ns.hasRootAccess(s));

		this.chunks = [];
		this.used = 0;
		this.free = 0;
		this.reserved = 0;
		this.total = 0;

		for(const server of servers) {
			const target = ns.getServer(server);

			if(server.startsWith("hacknet"))
				continue;

			const used = simulateMax ? 0 : target.ramUsed;
			const free = target.maxRam - used;
			const reserved = server === "home" ? MIN_HOME_RAM : 0;

			this.used += used;
			this.free += free;
			this.reserved += reserved;
			this.total += target.maxRam;

			if(free >= 0) {
				this.chunks.push({
					server,
					used,
					free,
					total: target.maxRam,
					reserved,
					bought: target.purchasedByPlayer
				});
			}
		}

		this.chunks.sort((a, b) => {
			if(a.server === "home")
				return 1;
			else if(b.server === "home")
				return -1;
			else if(a.free !== b.free)
				return a.free - b.free;

			return a.bought === b.bought ? 0 : a.bought ? -1 : 1;
		});
	}

	get chunkList() {
		return this.chunks;
	}

	Reserve(server, size) {
		const match = this.chunks.find(c => c.server === server);

		if(match == null || match.free - match.used >= size)
			return false;

		match.reserved += size;
		this.reserved += size;

		return true;
	}

	Smallest(min = 0) {
		let server;
		let size = 0;

		for(const chunk of this.chunks) {
			const free = chunk.free - chunk.reserved;

			if((server == null || free < size) && free >= min) {
				server = chunk.server;
				size = free;
			}
		}

		return server == null ? null : {server, size};
	}

	Largest() {
		let server;
		let size = 0;

		for(const chunk of this.chunks) {
			const free = chunk.free - chunk.reserved;

			if(server == null || free > size) {
				server = chunk.server;
				size = free;
			}
		}

		return server == null ? null : {server, size};
	}
}