import {MIN_HOME_RAM, PERSONAL_SERVER_SHARE} from "constants.js";
import {ScanAll} from "utility.js";

/** @param {import("../").NS} ns */
export class RAM {
	constructor(ns, simulateMax = false) {
		const servers = ScanAll(ns).filter(s => ns.hasRootAccess(s));

		this.chunks = [];
		this.used = 0;
		this.free = 0;
		this.total = 0;

		for(const server of servers) {
			const target = ns.getServer(server);

			if(server.startsWith("hacknet"))
				continue;

			const reduction = target.purchasedByPlayer ? Math.floor(target.maxRam * PERSONAL_SERVER_SHARE) : 0;
			const used = simulateMax ? 0 : target.ramUsed - reduction;
			const free = target.maxRam - used;

			this.used += used;
			this.free += free;
			this.total += target.maxRam;

			if(free >= 0) {
				this.chunks.push({
					server,
					used,
					free,
					total: target.maxRam,
					reserved: server === "home" ? MIN_HOME_RAM : reduction,
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

	Reserve(size) {
		const match = this.chunks.find(c => (c.free - c.reserved) >= size);

		if(match == null)
			return null;

		match.reserved += size;

		return match.server;
	}

	Smallest(min = 0) {
		let smallest = this.Largest();

		for(const chunk of this.chunks) {
			const free = chunk.free - chunk.reserved;

			if(free < smallest && free >= min)
				smallest = free;
		}

		return smallest;
	}

	Largest() {
		let largest = 0;

		for(const chunk of this.chunks) {
			const free = chunk.free - chunk.reserved;

			if(free > largest)
				largest = free;
		}

		return largest;
	}
}