import {HACK_LEVEL_RANGE, COLORS, BATCH_PORT} from "utility/constants.js";
import {TASKS, STAGE} from "utility/enums.js";
import {
	GenID, nFormat, Table, ClearLastLogs,
	ReadPort
} from "utility/misc.js";
import {
	GetWeakThreads, GetGrowThreads, GetThreads, GetMetrics
} from "utility/metrics.js";
import {RunScript} from "utility/run-script.js";
import {CalcDelays} from "utility/stalefish.js";

/**
 * @param {import("../").NS} ns
 * @param {import("../").Server} server
 */
function PrintPreparations(ns, server) {
	ClearLastLogs(ns, 1, COLORS.WARN);
	ns.print(`${COLORS.WARN}[?] Preparing...${Table({
		Security: `${nFormat(server.hackDifficulty, "l", 2)}/${nFormat(server.minDifficulty, "l", 2)}`,
		Cash: `$${nFormat(server.moneyAvailable)}/$${nFormat(server.moneyMax)}`
	}, COLORS.WARN)}`);
}

/** @param {import("../").NS} ns */
async function Prepare(ns, hostname) {
	let id;
	let ongoing = 0;

	while(true) {
		await ns.sleep(5);

		if(ongoing !== 0) {
			ongoing -= ReadPort(ns, BATCH_PORT).filter(i => i === id).length;

			if(ongoing !== 0)
				continue;
		}

		const server = ns.getServer(hostname);

		if(server.hackDifficulty !== server.minDifficulty) {
			id = GenID();
			ongoing = RunScript(
				ns,
				"weaken.js",
				hostname,
				GetWeakThreads(server.hackDifficulty - server.minDifficulty),
				true,
				true,
				id,
				BATCH_PORT
			).length;
			PrintPreparations(ns, server);
		}else if(server.moneyAvailable !== server.moneyMax) {
			id = GenID();
			ongoing = RunScript(
				ns,
				"grow.js",
				hostname,
				GetGrowThreads(ns, server, ns.getPlayer()),
				true,
				true,
				id,
				BATCH_PORT
			).length;
			PrintPreparations(ns, server);
		}else{
			PrintPreparations(ns, server);

			break;
		}
	}
}

class Scheduler {
	#delays = TASKS.LIST.reduce((map, key) => map.set(key, 0), new Map());
	#tasks = new Map();

	Add(type, createdAt, run) {
		const id = GenID();

		this.#tasks.set(id, {type, createdAt, run});

		return id;
	}

	Has(id) {
		return this.#tasks.has(id);
	}

	Cancel(id) {
		return this.#tasks.delete(id);
	}

	Adjust(delays) {
		for(const type of TASKS.LIST)
			this.#delays.set(type, delays[type]);
	}

	Run(now) {
		for(const [id, task] of this.#tasks) {
			const delay = this.#delays.get(task.type);

			if(task.createdAt + delay <= now) {
				this.tasks.delete(id);
				task.run(now - task.createdAt - delay);
			}
		}
	}
}

class Batch {
	// type -> scheduleID
	#scheduled = new Map();
	// taskID -> {type, pids: number[], done: 0}
	#running = new Map();
	#finished = TASKS.LIST.reduce((map, key) => map.set(key, false), new Map());

	Schedule(schedules) {
		for(const type of TASKS.LIST)
			this.#scheduled[type] = schedules[type];
	}

	TryFinish(id) {
		const task = this.#running.get(id);

		if(task == null)
			return false;

		++task.done;

		if(task.done === task.pids.length)
			this.#finished[task.type] = true;

		return true;
	}

	Cancel(scheduler) {

	}
}

class Batcher {
	/*. Inputs .*/
	/** @type {import("../").NS} */
	#ns;
	#hostname;
	#debug;
	/*. State .*/
	#stage = STAGE.PREPARING;
	#scheduler = new Scheduler();
	// batchID -> Batch
	#batches = new Map();
	#taskIDs = new Map();
	#started = 0;
	#createdAt;
	/*. Metrics .*/
	#level;
	#maxLevel;
	#percent;
	#period;
	#depth;
	#threads;

	constructor(ns, hostname, debug) {
		this.#ns = ns;
		this.#hostname = hostname;
		this.#debug = debug;
	}

	#Adjust() {
		this.#threads = GetThreads(this.#ns, this.#ns.getServer(this.#hostname), this.#ns.getPlayer(), this.#percent);
		this.#scheduler.Adjust(CalcDelays(this.#ns, this.#hostname, this.#period, this.#depth));
	}

	#Start(at) {}

	#Process(now) {
		this.#scheduler.Run(now);

		const ids = ReadPort(this.#ns, BATCH_PORT);

		for(const batch of this.#batches.values()) {
			if(ids.length === 0)
				break;

			for(let i = 0; i < ids.length; i++) {
				if(batch.TryFinish(ids[i]))
					ids.splice(i--, 1);
			}
		}
	}

	#Stop() {}

	async Run() {
		this.#createdAt = performance.now();
		this.#stage = STAGE.RUNNING;
		this.#level = this.#ns.getPlayer().skills.hacking;
		this.#maxLevel = this.#level + HACK_LEVEL_RANGE;

		const metrics = await GetMetrics(this.#ns, this.#hostname);

		this.#percent = metrics.percent;
		this.#period = metrics.period;
		this.#depth = metrics.depth;
		this.#Adjust(this.#level);

		while(true) {
			await this.#ns.sleep(5);

			const now = performance.now();

			if(this.#stage === STAGE.STOPPING) {
				this.#Process(now);

				continue;
			}

			const level = this.#ns.getPlayer().skills.hacking;

			if(level > this.#maxLevel) {
				this.#Stop();

				continue;
			}else if(this.#level !== level) {
				this.#level = level;
				this.#Adjust();
			}

			const nextAt = this.#createdAt + (this.#period * this.#started);

			if(nextAt <= now)
				this.#Start(nextAt);

			this.#Process(now);
		}
	}

	Exit() {
		if(this.#stage === STAGE.PREPARING)
			return;

		//
	}
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.tail();

	const hostname = String(ns.args[0]);
	const debug = Boolean(ns.args[1]);
	let batcher = new Batcher(ns, hostname, debug);
	let server;

	try {
		server = ns.getServer(hostname);
	}catch{
		return ns.tprint(`${COLORS.FAIL}[!] Server "${hostname}" doesn't exist.`);
	}

	if(!server.hasAdminRights)
		return ns.tprint(`${COLORS.FAIL}[!] Missing root access for "${hostname}".`);

	ns.atExit(() => batcher?.Exit());

	while(true) {
		await Prepare(ns, hostname);
		await batcher.Run();
		batcher = new Batcher(ns, hostname, debug);
	}
}