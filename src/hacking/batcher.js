import {
	IDS, SAFETY_THRESHOLD, HACK_LEVEL_RANGE, CHAIN_PORT,
	SUCCESS_COLOR, FAILURE_COLOR, WARNING_COLOR, SAFETY_DELAY
} from "utility/constants.js";
import {CheckPids, nFormat, Table} from "utility/generic.js";
import {GetHackPercent} from "utility/metrics.js";
import RunScript from "utility/run-script.js";
import {CalcDelays} from "utility/stalefish.js";
import {GetWeakThreads, GetGrowThreads, GetThreads} from "utility/threads.js";

const scripts = ["weaken.js", "weaken.js", "grow.js", "hack.js"];

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

	Edit(id, edits) {
		if(this.tasks.has(id)) {
			Object.assign(this.tasks.get(id), edits);

			return true;
		}

		return false;
	}

	Delete(id) {
		return this.tasks.delete(id);
	}

	Clear() {
		return this.tasks.clear();
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
	constructor(ns, server) {
		this.createdAt = performance.now();
		/** @type {import("../").NS} */
		this.ns = ns;
		this.server = server;
		this.port = ns.getPortHandle(CHAIN_PORT);
		this.port.clear();
		this.scheduler = new Scheduler();
		this.batches = new Map();
		this.ids = new Map();
		/*.
		 * 0 = preparing
		 * 1 = running
		 * 2 = stopping/stopped
		.*/
		this.stage = 0;
		this.restart = true;
		this.ran = 0;
		this.lastID = 0;
		this.cancelled = 0;
		this.desynced = 0;
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

	PrintStatus() {
		if(this.stage === 0) {
			const server = this.ns.getServer(this.server);
			const sec = nFormat(server.hackDifficulty, "l", 2);
			const minSec = nFormat(server.minDifficulty, "l", 2);
			const money = nFormat(server.moneyAvailable);
			const moneyMax = nFormat(server.moneyMax);

			this.ns.clearLog();
			this.ns.print(`${WARNING_COLOR}[?] Preparing...${Table(
				{Security: `${sec}/${minSec}`, Cash: `$${money}/$${moneyMax}`},
				WARNING_COLOR
			)}`);
		}else if(this.stage === 1) {
			const cancelledPct = nFormat(this.cancelled / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desynced / this.lastID * 100, "l", 2);

			this.ns.clearLog();
			this.ns.print(`${SUCCESS_COLOR}[-] Running...${Table({
				"Batch Duration": this.ns.tFormat(this.period * this.depth),
				"Max Depth": String(this.depth),
				"Hack Percent": `${this.percent * 100}%`,
				"Max Hacking Level": nFormat(this.levelMax, "l"),
				"Cancelled Batches": `${nFormat(this.cancelled, "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desynced, "l")} (${desyncedPct}%)`
			}, SUCCESS_COLOR)}`);
		}else if(this.stage === 2) {
			const cancelledPct = nFormat(this.cancelled / this.ran * 100, "l", 2);
			const desyncedPct = nFormat(this.desynced / this.lastID * 100, "l", 2);

			this.ns.clearLog();
			this.ns.print(`${FAILURE_COLOR}[-] Stopping...${Table({
				"Remaining Batches": nFormat(this.batches.size, "l"),
				"Cancelled Batches": `${nFormat(this.cancelled, "l")} (${cancelledPct}%)`,
				"Desynced Tasks": `${nFormat(this.desynced, "l")} (${desyncedPct}%)`
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

	async FinishPreparing() {
		const {pct, period, depth} = await GetHackPercent(this.ns, this.server);

		if(pct === 0) {
			this.restart = false;
			this.stage = 2;
			this.ns.print(`${FAILURE_COLOR}Not enough free RAM, exiting...`);

			return;
		}

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

	CancelTask(id, which) {
		const batch = this.batches.get(id);

		if(which === IDS.W2)
			this.scheduler.Delete(batch.scheduled[IDS.G]);

		this.scheduler.Delete(batch.scheduled[IDS.H]);

		if(!batch.partial) {
			++this.cancelled;
			batch.partial = true;
		}

		return which !== IDS.W1 && which !== IDS.W2;
	}

	StartBatch(now) {
		const batchID = this.ran;
		const batch = {scheduled: [], running: {}, partial: false};

		for(let i = IDS.W1; i <= IDS.H; i++) {
			const which = i;

			batch.scheduled[which] = this.scheduler.Schedule(which, now, this.delays[which], lateBy => {
				const server = this.ns.getServer(this.server);
				const unpreped = server.hackDifficulty !== server.minDifficulty || server.moneyAvailable !== server.moneyMax;
				const spread = which === IDS.W1 || which === IDS.W2;

				if((lateBy >= SAFETY_THRESHOLD || unpreped) && this.CancelTask(batchID, which))
					return;

				const id = this.GetID();

				this.ids.set(id, batchID);
				batch.running[id] = which;
				RunScript(this.ns, scripts[which], this.server, this.threads[which], spread, false, id, CHAIN_PORT);
			});
		}

		this.batches.set(batchID, batch);
		++this.ran;
	}

	ReadPort() {
		while(!this.port.empty()) {
			const id = this.port.read();
			const batchID = this.ids.get(id);
			const batch = this.batches.get(batchID);
			const which = batch?.running[id];

			if(batch == null)
				continue;

			if(!batch.partial) {
				if(which === IDS.H && Object.keys(batch.running).length !== 4)
					++this.desynced;
				else if(which === IDS.W1 && Object.keys(batch.running).length !== 3)
					++this.desynced;
				else if(which === IDS.G && Object.keys(batch.running).length !== 2)
					++this.desynced;
				else if(which === IDS.W2 && Object.keys(batch.running).length !== 1)
					++this.desynced;
			}

			delete batch.running[id];
			this.ids.delete(id);
		}

		for(const [id, batch] of this.batches.entries()) {
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
		const nextBatchAt = this.createdAt + (this.period * this.ran);

		if(level !== this.level) {
			if(level > this.levelMax)
				return this.stage = 2;

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

		this.PrintStatus();
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

	const target = ns.args[0];

	try {
		ns.getServer(target);
	}catch{
		return ns.tprint(`${FAILURE_COLOR}Server "${target}" doesn't exist.`);
	}

	let batcher = new Batcher(ns, target);

	while(true) {
		if(batcher.Stopped() && batcher.CanRestart()) {
			await ns.sleep(SAFETY_DELAY * 2);
			batcher = new Batcher(ns, target);
		}

		await batcher.Update();
		await ns.sleep(5);
	}
}