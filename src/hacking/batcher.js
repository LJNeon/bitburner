import {
	IDS, SAFETY_THRESHOLD, HACK_LEVEL_RANGE, CHAIN_PORT,
	SUCCESS_COLOR, FAILURE_COLOR, WARNING_COLOR, SAFETY_DELAY,
	SCRIPTS_BY_ID
} from "utility/constants.js";
import {
	CheckPids, nFormat, Table, DeleteLogLines
} from "utility/generic.js";
import {
	GetWeakThreads, GetGrowThreads, GetThreads, GetHackPercent
} from "utility/metrics.js";
import RunScript from "utility/run-script.js";
import {CalcDelays} from "utility/stalefish.js";

class Scheduler {
	constructor() {
		this.lastID = 0;
		this.tasks = new Map();
	}

	GenID() {
		return this.lastID = (this.lastID + 1) % Number.MAX_SAFE_INTEGER;
	}

	Schedule(type, createdAt, delay, run) {
		const id = this.GenID(Array.from(this.tasks.keys()));

		this.tasks.set(id, {
			createdAt,
			type,
			delay,
			run
		});

		return id;
	}

	Has(id) {
		return this.tasks.has(id);
	}

	Delete(id) {
		return this.tasks.delete(id);
	}

	Run(now) {
		for(const [id, task] of this.tasks.entries()) {
			if(task.createdAt + task.delay <= now) {
				this.tasks.delete(id);
				task.run(now - task.createdAt - task.delay);
			}
		}
	}

	AdjustDelays(delays) {
		for(const task of this.tasks.values())
			task.delay = delays[task.type];
	}
}

class Batcher {
	/** @param {import("../").NS} ns */
	constructor(ns, server, debug) {
		/** @type {import("../").NS} */
		this.ns = ns;
		this.server = server;
		this.debug = debug;
		this.port = ns.getPortHandle(CHAIN_PORT);
		this.port.clear();
		this.scheduler = new Scheduler(this);
		this.batches = new Map();
		this.ids = new Map();
		/*.
		 * 0 = preparing
		 * 1 = running
		 * 2 = stopping
		.*/
		this.stage = 0;
		this.restart = true;
		this.ran = 0;
		this.lastID = 0;
		this.cancels = [0, 0];
		this.desyncs = 0;
		this.AdjustForLevel();
	}

	GetID() {
		return this.lastID = (this.lastID + 1) % Number.MAX_SAFE_INTEGER;
	}

	AdjustForLevel() {
		this.threads = GetThreads(this.ns, this.server, this.percent);
		this.delays = CalcDelays(this.ns, this.server, this.period, this.depth);
		this.scheduler.AdjustDelays(this.delays);
	}

	WriteDebug(info) {
		if(!this.debug)
			return;

		const name = `debug-${Math.floor(this.startedAt)}.txt`;

		if(this.ns.fileExists(name))
			this.ns.write(name, `\n${JSON.stringify(info)}`, "a");
		else
			this.ns.write(name, JSON.stringify(info), "w");
	}

	PrintStatus(started) {
		if(started)
			DeleteLogLines(this.ns, 1);

		if(this.stage === 0) {
			const server = this.ns.getServer(this.server);
			const sec = nFormat(server.hackDifficulty, "l", 2);
			const minSec = nFormat(server.minDifficulty, "l", 2);
			const money = nFormat(server.moneyAvailable);
			const moneyMax = nFormat(server.moneyMax);

			this.ns.print(`${WARNING_COLOR}[?] Preparing...${Table(
				{Security: `${sec}/${minSec}`, Cash: `$${money}/$${moneyMax}`},
				WARNING_COLOR
			)}`);
		}else if(this.stage === 1) {
			const cancelledPct = nFormat(this.cancels.reduce((a, b) => a + b) / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desyncs / this.lastID * 100, "l", 2);

			this.ns.print(`${SUCCESS_COLOR}[-] Running...${Table({
				"Batch Duration": this.ns.tFormat(this.period * this.depth),
				"Max Depth": String(this.depth),
				"Hack Percent": `${this.percent * 100}%`,
				"Max Hacking Level": nFormat(this.levelMax, "l"),
				"Cancelled Batches": `${nFormat(this.cancels[0], "l")}/${nFormat(this.cancels[1], "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desyncs, "l")} (${desyncedPct}%)`
			}, SUCCESS_COLOR)}`);
		}else if(this.Stopped()) {
			const cancelledPct = nFormat(this.cancels.reduce((a, b) => a + b) / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desyncs / this.lastID * 100, "l", 2);

			this.ns.print(`${FAILURE_COLOR}[!] Stopped...${Table({
				"Batches Ran": nFormat(this.ran, "l"),
				"Cancelled Batches": `${nFormat(this.cancels[0], "l")}/${nFormat(this.cancels[1], "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desyncs, "l")} (${desyncedPct}%)`
			}, FAILURE_COLOR)}`);
		}else{
			const cancelledPct = nFormat(this.cancels.reduce((a, b) => a + b) / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desyncs / this.lastID * 100, "l", 2);

			this.ns.print(`${FAILURE_COLOR}[!] Stopping...${Table({
				"Remaining Batches": nFormat(this.batches.size, "l"),
				"Cancelled Batches": `${nFormat(this.cancels[0], "l")}/${nFormat(this.cancels[1], "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desyncs, "l")} (${desyncedPct}%)`
			}, FAILURE_COLOR)}`);
		}
	}

	StartPreparing() {
		const server = this.ns.getServer(this.server);
		const pids = [];

		if(server.hackDifficulty > server.minDifficulty) {
			const threads = GetWeakThreads(server.hackDifficulty - server.minDifficulty);

			pids.push(...RunScript(this.ns, "weaken.js", this.server, threads, true, true));
		}else if(server.moneyAvailable < server.moneyMax) {
			const threads = GetGrowThreads(this.ns, server, this.ns.getPlayer());

			pids.push(...RunScript(this.ns, "grow.js", this.server, threads, false, true));
		}

		this.preparing = pids;
	}

	Stop() {
		this.stage = 2;

		for(const [batchID, batch] of Array.from(this.batches.entries())) {
			if(!batch.running.hasOwnProperty(IDS.H)) {
				for(let i = IDS.W1; i <= IDS.H; i++) {
					if(this.scheduler.Delete(batch.scheduled[i]))
						this.WriteDebug({type: "cancelled", batchID, which: i});
				}

				for(const task of Object.values(batch.running)) {
					if(task.pids.map(p => this.ns.kill(p)).includes(true))
						this.WriteDebug({type: "killed", batchID, which: task.which});
				}

				this.batches.delete(batchID);
			}
		}
	}

	async FinishPreparing() {
		const {pct, period, depth} = await GetHackPercent(this.ns, this.server);

		if(pct === 0) {
			this.restart = false;
			this.Stop();
			this.ns.print(`${FAILURE_COLOR}Not enough free RAM, exiting...`);

			return;
		}

		this.startedAt = performance.now();
		this.stage = 1;
		this.percent = pct;
		this.period = period;
		this.depth = depth;
		this.level = this.ns.getPlayer().skills.hacking;
		this.levelMax = this.level + HACK_LEVEL_RANGE;
		this.AdjustForLevel();
	}

	async Prepare() {
		const server = this.ns.getServer(this.server);

		if(server.hackDifficulty === server.minDifficulty && server.moneyAvailable === server.moneyMax)
			await this.FinishPreparing();
		else if(this.preparing == null || CheckPids(this.ns, this.preparing))
			this.StartPreparing();
	}

	CancelNextHack() {
		for(const [batchID, batch] of this.batches.entries()) {
			const id = Object.keys(batch.running).find(k => batch.running[k].which === IDS.H);

			if(id != null) {
				if(!batch.partial) {
					++this.cancels[1];
					batch.partial = true;
				}

				if(batch.running[id].pids.map(pid => this.ns.kill(pid)).includes(true))
					this.WriteDebug({type: "killed", batchID, which: IDS.H});

				delete batch.running[id];
			}
		}
	}

	CancelTask(id, which, unprepped) {
		if(unprepped)
			this.CancelNextHack();

		const batch = this.batches.get(id);
		const shouldCancel = unprepped || (which !== IDS.W1 && which !== IDS.W2);

		if(!batch.partial) {
			++this.cancels[Number(unprepped)];
			batch.partial = true;
		}

		if(which === IDS.W2 && this.scheduler.Delete(batch.scheduled[IDS.G]))
			this.WriteDebug({type: "cancelled", batchID: id, which: IDS.G});

		if(this.scheduler.Delete(batch.scheduled[IDS.H]))
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

			batch.scheduled[which] = this.scheduler.Schedule(which, now, this.delays[which], lateBy => {
				const server = this.ns.getServer(this.server);
				const unprepped = server.hackDifficulty !== server.minDifficulty || server.moneyAvailable !== server.moneyMax;

				if((lateBy >= SAFETY_THRESHOLD || unprepped) && this.CancelTask(batchID, which, unprepped))
					return;

				const id = this.GetID();
				const pids = RunScript(
					this.ns,
					SCRIPTS_BY_ID[which],
					this.server,
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

		this.batches.set(batchID, batch);
		++this.ran;
	}

	ReadPort() {
		while(!this.port.empty()) {
			const id = this.port.read();
			const batchID = this.ids.get(id);
			const batch = this.batches.get(batchID);

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

		for(const [id, batch] of Array.from(this.batches.entries())) {
			if(batch.scheduled.every(s => !this.scheduler.Has(s)) && Object.keys(batch.running).length === 0)
				this.batches.delete(id);
		}
	}

	HandleTasks(now) {
		this.scheduler.Run(now);
		this.ReadPort();
	}

	Run() {
		const now = performance.now();
		const level = this.ns.getPlayer().skills.hacking;
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

	async Update() {
		switch(this.stage) {
			case 0:
				await this.Prepare();

				break;
			case 1:
				this.Run();

				break;
			case 2:
				this.HandleTasks(performance.now());

				break;
		}
	}

	Stopped() {
		return this.stage >= 2 && this.batches.size === 0;
	}

	CanRestart() {
		return this.restart;
	}
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

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
	let started = false;

	while(true) {
		if(batcher.Stopped()) {
			if(!batcher.CanRestart())
				break;

			await ns.sleep(SAFETY_DELAY * 2);
			batcher.PrintStatus(true);
			batcher = new Batcher(ns, target, debug);
			started = false;
		}

		await batcher.Update();
		batcher.PrintStatus(started);

		if(!started)
			started = true;

		await ns.sleep(5);
	}
}