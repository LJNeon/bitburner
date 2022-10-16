import {NS} from "@ns";
import Maybe, {just, nothing} from "@true-myth/maybe";
import {
	WEAKEN_GROW_RAM, HACK_RAM, MIN_HOME_RAM, PERSONAL_SERVER_SHARE
} from "utility/constants";
import {Task} from "utility/enums";
import {Impossible, ScanAll} from "utility/misc";

interface Chunk {
	hostname: string;
	threads: number;
}

export default class RAM {
	#ns;
	#chunks = new Map<string, number>();
	#total = 0;

	constructor(ns: NS, simulate = false) {
		this.#ns = ns;

		const servers = ScanAll(this.#ns)
			.map(n => this.#ns.getServer(n))
			.filter(s => s.hasAdminRights && s.maxRam > 0 && !s.hostname.startsWith("hacknet"));

		for(const server of servers) {
			let size = server.maxRam - (simulate ? 0 : server.ramUsed);

			if(server.hostname === "home")
				size -= MIN_HOME_RAM;
			else if(server.purchasedByPlayer && (simulate || ns.getRunningScript("share.js", server.hostname) == null))
				size -= server.maxRam * PERSONAL_SERVER_SHARE;

			if(size < HACK_RAM)
				continue;

			this.#total += size;
			this.#chunks.set(server.hostname, size);
		}
	}

	Get(hostname: string) {
		return Maybe.of(this.#chunks.get(hostname));
	}

	Total() {
		return this.#total;
	}

	Largest(task: Task, min = 1) {
		const per = task === Task.Hack ? HACK_RAM : WEAKEN_GROW_RAM;
		let info: Maybe<Chunk> = nothing();

		for(const [hostname, size] of this.#chunks) {
			const threads = Math.floor(size / per);

			if(threads >= min && info.mapOr(true, i => threads > i.threads))
				info = just({hostname, threads});
		}

		return info;
	}

	#AdjustHome(threads: number) {
		const {cpuCores} = this.#ns.getServer("home");

		if(cpuCores !== 1)
			return threads;

		return Math.ceil(threads / (1 + ((cpuCores - 1) / 16)));
	}

	Reserve(task: Task, threads: number, partial = false): Maybe<Chunk> {
		return (partial ? this.Largest(task) : this.Largest(task, threads)).match({
			Just: server => {
				const per = task === Task.Hack ? HACK_RAM : WEAKEN_GROW_RAM;
				const size = this.Get(server.hostname).unwrapOrElse(() => {throw Impossible();});

				if(server.hostname === "home")
					server.threads = this.#AdjustHome(server.threads);

				this.#chunks.set(server.hostname, size - (server.threads * per));

				return Maybe.of(server);
			},
			Nothing: () => nothing()
		});
	}

	ReserveAll(task: Task, threads: number, partial = false): Maybe<Chunk[]> {
		const servers: Chunk[] = [];
		let spawned = 0;
		let chunk: Chunk | false;

		while((chunk = this.Largest(task).unwrapOr(false)) !== false) {
			let total = threads - spawned < chunk.threads ? threads - spawned : chunk.threads;

			spawned += total;

			if(chunk.hostname === "home")
				total = this.#AdjustHome(total);

			servers.push({hostname: chunk.hostname, threads: total});

			if(spawned >= threads)
				break;
		}

		if(!partial && spawned < threads)
			return nothing();

		const per = task === Task.Hack ? HACK_RAM : WEAKEN_GROW_RAM;

		for(const server of servers) {
			const size = this.Get(server.hostname).unwrapOrElse(() => {throw Impossible();});

			this.#chunks.set(server.hostname, size - (server.threads * per));
		}

		return Maybe.of(servers);
	}
}