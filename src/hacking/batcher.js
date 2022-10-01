import {
	IDS, SAFETY_THRESHOLD, HACK_LEVEL_RANGE, CHAIN_PORT,
	SUCCESS_COLOR, FAILURE_COLOR, WARNING_COLOR, JOB_SPACER,
	SCRIPTS_BY_ID
} from "utility/constants.js";
import {STAGE, TASKS} from "utility/enums.js";
import {
	GenID, CheckPids, nFormat, Table,
	DeleteLogLines
} from "utility/misc.js";
import {
	GetWeakThreads, GetGrowThreads, GetThreads, GetMetrics
} from "utility/metrics.js";
import {RunScript} from "utility/run-script.js";
import {CalcDelays} from "utility/stalefish.js";

class Scheduler {
	#delays = TASKS.LIST.reduce((obj, key) => (obj[key] = 0, obj), {});
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
			this.#delays[type] = delays[type];
	}

	Run(now) {
		for(const [id, task] of this.#tasks) {
			if(task.createdAt + this.#delays[task.type] <= now) {
				this.tasks.delete(id);
				task.run(now - task.createdAt - this.#delays[task.type]);
			}
		}
	}
}

class Batcher {
	/** @type {import("../").NS} */
	#ns;
	#hostname;
	#debug;
	#scheduler = new Scheduler();
	#batches = new Map();
	#port;
	#stage = STAGE.PREPARING;

	/** @param {import("../").NS} ns */
	constructor(ns, hostname, debug) {
		this.#ns = ns;
		this.#hostname = hostname;
		this.#debug = debug;
		this.#port = ns.getPortHandle(CHAIN_PORT);
		this.#port.clear();
		this.ids = new Map();
		this.restart = true;
		this.firstPrint = true;
		this.cancelledHack = false;
		this.ran = 0;
		this.lastID = 0;
		this.cancels = [0, 0];
		this.desyncs = 0;
		this.AdjustForLevel();
	}

	AdjustForLevel() {
		this.threads = GetThreads(this.#ns, this.#ns.getServer(this.#hostname), this.#ns.getPlayer(), this.percent);
		this.#scheduler.Update(CalcDelays(this.#ns, this.#hostname, this.period, this.depth));
	}

	WriteDebug(info) {
		if(!this.#debug)
			return;

		const name = `debug-${Math.floor(this.startedAt)}.txt`;

		if(this.#ns.fileExists(name))
			this.#ns.write(name, `\n${JSON.stringify(info)}`, "a");
		else
			this.#ns.write(name, JSON.stringify(info), "w");
	}

	PrintStatus() {
		if(this.firstPrint)
			this.firstPrint = false;
		else
			DeleteLogLines(this.#ns, 1);

		if(this.#stage === STAGE.PREPARING) {
			const server = this.#ns.getServer(this.#hostname);
			const sec = nFormat(server.hackDifficulty, "l", 2);
			const minSec = nFormat(server.minDifficulty, "l", 2);
			const money = nFormat(server.moneyAvailable);
			const moneyMax = nFormat(server.moneyMax);

			this.#ns.print(`${WARNING_COLOR}[?] Preparing...${Table(
				{Security: `${sec}/${minSec}`, Cash: `$${money}/$${moneyMax}`},
				WARNING_COLOR
			)}`);
		}else if(this.#stage === STAGE.RUNNING) {
			const cancelledPct = nFormat(this.cancels.reduce((a, b) => a + b) / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desyncs / this.lastID * 100, "l", 2);

			this.#ns.print(`${SUCCESS_COLOR}[-] Running...${Table({
				"Batch Duration": this.#ns.tFormat(this.period * this.depth),
				"Max Depth": String(this.depth),
				"Hack Percent": `${this.percent * 100}%`,
				"Max Hacking Level": nFormat(this.levelMax, "l"),
				"Cancelled Batches": `${nFormat(this.cancels[0], "l")}/${nFormat(this.cancels[1], "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desyncs, "l")} (${desyncedPct}%)`
			}, SUCCESS_COLOR)}`);
		}else if(this.Stopped()) {
			const cancelledPct = nFormat(this.cancels.reduce((a, b) => a + b) / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desyncs / this.lastID * 100, "l", 2);

			this.#ns.print(`${FAILURE_COLOR}[!] Stopped...${Table({
				"Batches Ran": nFormat(this.ran, "l"),
				"Cancelled Batches": `${nFormat(this.cancels[0], "l")}/${nFormat(this.cancels[1], "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desyncs, "l")} (${desyncedPct}%)`
			}, FAILURE_COLOR)}`);
		}else{
			const cancelledPct = nFormat(this.cancels.reduce((a, b) => a + b) / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desyncs / this.lastID * 100, "l", 2);

			this.#ns.print(`${FAILURE_COLOR}[!] Stopping...${Table({
				"Remaining Batches": nFormat(this.#batches.size, "l"),
				"Cancelled Batches": `${nFormat(this.cancels[0], "l")}/${nFormat(this.cancels[1], "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desyncs, "l")} (${desyncedPct}%)`
			}, FAILURE_COLOR)}`);
		}
	}

	StartPreparing() {
		const server = this.#ns.getServer(this.#hostname);
		const pids = [];

		if(server.hackDifficulty > server.minDifficulty) {
			const threads = GetWeakThreads(server.hackDifficulty - server.minDifficulty);

			pids.push(...RunScript(this.#ns, "weaken.js", this.#hostname, threads, true, true));
		}else if(server.moneyAvailable < server.moneyMax) {
			const threads = GetGrowThreads(this.#ns, server, this.#ns.getPlayer());

			pids.push(...RunScript(this.#ns, "grow.js", this.#hostname, threads, false, true));
		}

		this.preparing = pids;
	}

	Stop() {
		this.#stage = STAGE.STOPPING;

		for(const [batchID, batch] of Array.from(this.#batches.entries())) {
			if(Object.values(batch.running).find(r => r.which === IDS.H) == null) {
				for(let i = IDS.W1; i <= IDS.H; i++) {
					if(this.#scheduler.Cancel(batch.scheduled[i]))
						this.WriteDebug({type: "cancelled", batchID, which: i});
				}

				for(const task of Object.values(batch.running)) {
					if(task.pids.map(p => this.#ns.kill(p)).includes(true))
						this.WriteDebug({type: "killed", batchID, which: task.which});
				}

				this.#batches.delete(batchID);
			}
		}
	}

	async FinishPreparing() {
		const {pct, period, depth} = await GetMetrics(this.#ns, this.#hostname);

		if(pct === 0) {
			this.restart = false;
			this.Stop();
			this.#ns.print(`${FAILURE_COLOR}Not enough free RAM, exiting...`);

			return;
		}

		this.startedAt = performance.now();
		this.#stage = STAGE.RUNNING;
		this.percent = pct;
		this.period = period;
		this.depth = depth;
		this.level = this.#ns.getPlayer().skills.hacking;
		this.levelMax = this.level + HACK_LEVEL_RANGE;
		this.AdjustForLevel();
	}

	async Prepare() {
		const server = this.#ns.getServer(this.#hostname);

		if(server.hackDifficulty === server.minDifficulty && server.moneyAvailable === server.moneyMax)
			await this.FinishPreparing();
		else if(this.preparing == null || CheckPids(this.#ns, this.preparing))
			this.StartPreparing();
	}

	CancelNextHack() {
		this.cancelledHack = true;

		for(const [batchID, batch] of this.#batches.entries()) {
			const id = Object.keys(batch.running).find(k => batch.running[k].which === IDS.H);

			if(id != null) {
				if(!batch.partial) {
					++this.cancels[1];
					batch.partial = true;
				}

				if(batch.running[id].pids.map(pid => this.#ns.kill(pid)).includes(true))
					this.WriteDebug({type: "killed", batchID, which: IDS.H});

				delete batch.running[id];
			}
		}
	}

	CancelTask(id, which, unprepped) {
		if(unprepped && !this.cancelledHack)
			this.CancelNextHack();

		const batch = this.#batches.get(id);
		const shouldCancel = unprepped || (which !== IDS.W1 && which !== IDS.W2);

		if(!batch.partial) {
			++this.cancels[Number(unprepped)];
			batch.partial = true;
		}

		if(which === IDS.W2 && this.#scheduler.Cancel(batch.scheduled[IDS.G]))
			this.WriteDebug({type: "cancelled", batchID: id, which: IDS.G});

		if(this.#scheduler.Cancel(batch.scheduled[IDS.H]))
			this.WriteDebug({type: "cancelled", batchID: id, which: IDS.H});

		if(shouldCancel)
			this.WriteDebug({type: "cancelled", batchID: id, which});

		return shouldCancel;
	}

	StartBatch(now) {
		const batchID = this.ran;
		const batch = {scheduled: [], running: {}, partial: false};

		for(let i = IDS.W1; i <= IDS.H; i++) {
			const which = i;

			batch.scheduled[which] = this.#scheduler.Add(which, now, lateBy => {
				const server = this.#ns.getServer(this.#hostname);
				const unprepped = server.hackDifficulty !== server.minDifficulty || server.moneyAvailable !== server.moneyMax;

				if(!unprepped && this.cancelledHack)
					this.cancelledHack = false;

				if((lateBy >= SAFETY_THRESHOLD || unprepped) && this.CancelTask(batchID, which, unprepped))
					return;

				const id = GenID();
				const pids = RunScript(
					this.#ns,
					SCRIPTS_BY_ID[which],
					this.#hostname,
					this.threads[which],
					which === IDS.W1 || which === IDS.W2,
					false,
					id,
					CHAIN_PORT
				);

				this.ids.set(id, batchID);
				batch.running[id] = {which, pids};
				this.WriteDebug({type: "ran", batchID, which});
			});
			this.WriteDebug({type: "scheduled", batchID, which});
		}

		this.#batches.set(batchID, batch);
		++this.ran;
	}

	ProcessPort() {
		while(!this.#port.empty()) {
			const id = this.#port.read();
			const batchID = this.ids.get(id);
			const batch = this.#batches.get(batchID);

			if(batch == null)
				continue;

			const {which} = batch.running[id];

			if(!batch.partial) {
				if((which === IDS.H && Object.keys(batch.running).length !== 4)
						|| (which === IDS.W1 && Object.keys(batch.running).length !== 3)
						|| (which === IDS.G && Object.keys(batch.running).length !== 2)
						|| (which === IDS.W2 && Object.keys(batch.running).length !== 1)) {
					++this.desyncs;
					this.WriteDebug({type: "desynced", batchID, which});
				}
			}

			delete batch.running[id];
			this.ids.delete(id);
			this.WriteDebug({type: "finished", batchID, which});
		}
	}

	Clean(now) {
		this.#scheduler.Run(now);
		this.ProcessPort();

		for(const [batchID, batch] of Array.from(this.#batches.entries())) {
			for(const id in batch.running) {
				if(CheckPids(this.#ns, batch.running[id].pids)) {
					const {which} = batch.running[id];

					if(!batch.partial) {
						if((which === IDS.H && Object.keys(batch.running).length !== 4)
								|| (which === IDS.W1 && Object.keys(batch.running).length !== 3)
								|| (which === IDS.G && Object.keys(batch.running).length !== 2)
								|| (which === IDS.W2 && Object.keys(batch.running).length !== 1)) {
							++this.desyncs;
							this.WriteDebug({type: "desynced", batchID, which});
						}
					}

					delete batch.running[id];
					this.ids.delete(id);
					this.WriteDebug({type: "finished", batchID, which});
				}
			}

			if(batch.scheduled.every(s => !this.#scheduler.Has(s)) && Object.keys(batch.running).length === 0)
				this.#batches.delete(batchID);
		}
	}

	Run() {
		const now = performance.now();
		const level = this.#ns.getPlayer().skills.hacking;
		const nextBatchAt = this.startedAt + (this.period * this.ran);

		if(level !== this.level) {
			if(level > this.levelMax)
				return this.Stop();

			this.level = level;
			this.AdjustForLevel();
		}

		if(nextBatchAt <= now)
			this.StartBatch(nextBatchAt);

		this.HandleTasks(now);
	}

	Update() {
		const now = performance.now();

		switch(this.#stage) {
			case STAGE.PREPARING:
				return this.Prepare();
			case STAGE.RUNNING:
				return this.Run(now);
			case STAGE.STOPPING:
				return this.Clean(now);
		}
	}

	Stopped() {
		return this.#stage === STAGE.STOPPING && this.#batches.size === 0;
	}

	CanRestart() {
		return this.restart;
	}
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.tail();

	const [target, debug = false] = ns.args;
	let server;

	try {
		server = ns.getServer(target);
	}catch{
		return ns.tprint(`${FAILURE_COLOR}Server "${target}" doesn't exist.`);
	}

	if(!server.hasAdminRights)
		return ns.tprint(`${FAILURE_COLOR}Missing root access for "${target}".`);

	let batcher = new Batcher(ns, target, debug);

	while(true) {
		if(batcher.Stopped()) {
			if(!batcher.CanRestart())
				break;

			await ns.sleep(JOB_SPACER * 2);
			batcher.PrintStatus();
			batcher = new Batcher(ns, target, debug);
		}

		await batcher.Update();
		batcher.PrintStatus();
		await ns.sleep(5);
	}
}