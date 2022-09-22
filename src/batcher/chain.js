import {
	IDS, SAFETY_THRESHOLD, HACK_LEVEL_RANGE, TAIL_COLORS,
	DEFAULT_COLOR
} from "constants.js";
import {CheckPids} from "utility.js";
import {GetHackPercent} from "batcher/metrics.js";
import RunScript from "batcher/run-script.js";
import {CalcDelays} from "batcher/stalefish.js";
import {GetWeakThreads, GetGrowThreads, GetThreads} from "batcher/threads.js";

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
	constructor(ns, metrics) {
		/** @type {import("../").NS} */
		this.ns = ns;
		this.server = metrics.target;
		this.hackPct = metrics.pct;
		this.period = metrics.period;
		this.depth = metrics.depth;
		this.level = ns.getPlayer().skills.hacking;
		this.levelMax = this.level + HACK_LEVEL_RANGE;
		this.createdAt = performance.now();
		this.ran = 0;
		this.scheduler = new Scheduler();
		this.batches = new Map();
		// 0 = preparing, 1 = running, 2 = stopping
		this.stage = 0;
		this.invalidated = false;
		this.AdjustForLevel();
	}

	GetColor(id) {
		return TAIL_COLORS[id % TAIL_COLORS.length];
	}

	GetName(which) {
		switch(which) {
			case IDS.W1:
			case IDS.W2:
				return "Weaken";
			case IDS.G:
				return "Grow";
			case IDS.H:
				return "Hack";
		}
	}

	EndOrder(which) {
		switch(which) {
			case IDS.H:
				return "1";
			case IDS.W1:
				return "2";
			case IDS.G:
				return "3";
			case IDS.W2:
				return "4";
		}
	}

	AdjustForLevel() {
		this.threads = GetThreads(this.ns, this.server, this.hackPct);
		this.delays = CalcDelays(this.ns, this.server, this.period, this.depth);
		this.scheduler.AdjustDelays(this.delays);
	}

	StartPreparing() {
		const server = this.ns.getServer(this.server);
		const pids = [];

		if(server.hackDifficulty > server.minDifficulty) {
			const threads = GetWeakThreads(server.hackDifficulty - server.minDifficulty);
			const sec = server.hackDifficulty.toFixed(2);
			const minSec = server.minDifficulty.toFixed(2);

			this.ns.print(`${DEFAULT_COLOR}[!] ${sec}/${minSec} security.`);
			pids.push(...RunScript(this.ns, "weaken.js", this.server, threads, true, true));
		}else if(server.moneyAvailable < server.moneyMax) {
			const threads = GetGrowThreads(this.ns, server, this.ns.getPlayer());
			const money = this.ns.nFormat(server.moneyAvailable, "$0[.0]a");
			const moneyMax = this.ns.nFormat(server.moneyMax, "$0[.0]a");

			this.ns.print(`${DEFAULT_COLOR}[!] ${money}/${moneyMax} money.`);
			pids.push(...RunScript(this.ns, "grow.js", this.server, threads, false, true));
		}

		this.preparing = pids;
	}

	Prepare() {
		const server = this.ns.getServer(this.server);

		if(server.hackDifficulty === server.minDifficulty && server.moneyAvailable === server.moneyMax) {
			this.stage = 1;
			this.ns.print(`${DEFAULT_COLOR}[-] Prepared! First batch done in ${this.ns.tFormat(this.period * this.depth)}.`);
		}else if(this.preparing == null || CheckPids(this.ns, this.preparing)) {
			this.StartPreparing();
		}
	}

	Stop() {
		this.stage = 2;
		this.scheduler.Clear();
	}

	CancelTask(id, which, diff) {
		const batch = this.batches.get(id);

		if(which === IDS.W2 || which === IDS.G) {
			this.scheduler.Delete(batch.pending[IDS.G]);
			batch.finished[IDS.G] = true;
		}

		this.scheduler.Delete(batch.pending[IDS.H]);
		batch.finished[IDS.H] = true;

		if(!batch.cancelled) {
			batch.cancelled = true;
			this.ns.print(`${DEFAULT_COLOR}[!] Batch ${id + 1} cancelled (${diff.toFixed(2)}).`);
		}

		return which !== IDS.W1 && which !== IDS.W2;
	}

	StartBatch(now) {
		const id = this.ran;
		const batch = {pending: [], pids: [], finished: Array(4).fill(false)};

		for(let i = IDS.W1; i <= IDS.H; i++) {
			const which = i;

			batch.pending[which] = this.scheduler.Schedule(which, now, this.delays[which], lateBy => {
				const server = this.ns.getServer(this.server);
				const notMinSec = server.minDifficulty !== server.hackDifficulty;
				const spread = which === IDS.W1 || which === IDS.W2;

				if((lateBy >= SAFETY_THRESHOLD || notMinSec) && this.CancelTask(id, which, notMinSec || lateBy))
					return;

				batch.pids[which] = RunScript(this.ns, scripts[which], this.server, this.threads[which], spread);
			});
		}

		this.batches.set(id, batch);
		++this.ran;
	}

	HandleCompletedBatches() {
		for(const [id, batch] of this.batches.entries()) {
			const color = this.GetColor(id);

			for(let i = IDS.W1; i <= IDS.H; i++) {
				if(batch.pids[i] != null && !batch.finished[i] && CheckPids(this.ns, batch.pids[i])) {
					batch.finished[i] = true;
					this.ns.print(`${color}[${this.EndOrder(i)}] ${this.GetName(i)} x${this.threads[i]} finished.`);
				}
			}

			if(batch.finished.every(f => f)) {
				this.batches.delete(id);
				this.ns.print(`${color}[-] Batch ${id + 1} ${batch.cancelled ? "partially " : ""}completed.`);
			}
		}
	}

	Run() {
		const now = performance.now();
		const level = this.ns.getPlayer().skills.hacking;
		const nextBatchAt = this.createdAt + (this.period * this.ran);

		if(level !== this.level) {
			if(level > this.levelMax)
				return this.Stop();

			this.AdjustForLevel();
			this.level = level;
		}

		if(nextBatchAt <= now)
			this.StartBatch(nextBatchAt);

		this.scheduler.Run(now);
		this.HandleCompletedBatches();
	}

	Update() {
		switch(this.stage) {
			case 0:
				this.Prepare();

				break;
			case 1:
				this.Run();

				break;
			case 2:
				this.HandleCompletedBatches();

				break;
		}
	}

	Stopped() {
		return this.stage === 2 && this.batches.size === 0;
	}
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const target = ns.args[0];

	try {
		ns.getServer(target);
	}catch{
		return ns.tprint(`${DEFAULT_COLOR}Server "${target}" doesn't exist.`);
	}

	let metrics = await GetHackPercent(ns, target);

	if(metrics.pct === 0)
		return ns.tprint(`${DEFAULT_COLOR}Not enough available RAM to batch on "${target}".`);

	let batcher = new Batcher(ns, metrics);

	ns.print(`${DEFAULT_COLOR}[-] Starting, will hack at ${metrics.pct * 100}%...`);

	while(true) {
		if(batcher.Stopped()) {
			metrics = await GetHackPercent(ns, target);
			ns.print(`${DEFAULT_COLOR}[-] Restarting, will hack at ${metrics.pct * 100}%...`);
			batcher = new Batcher(ns, metrics);
		}

		batcher.Update();
		await ns.sleep(5);
	}
}