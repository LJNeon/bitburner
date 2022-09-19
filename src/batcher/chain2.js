import {
	MONEY_PER_HACK, SAFETY_THRESHOLD, HACK_LEVEL_RANGE, CHAIN_VIABLE_THRESHOLD,
	DEFAULT_COLOR, CONSOLE_COLORS
} from "constants.js";
import {
	CheckPids, GetWeakThreads, GetGrowThreads, GetThreads
} from "utility.js";
import {RAM} from "batcher/ram.js";
import {RunScript} from "batcher/run-script.js";
import {CalcPeriodDepth, CalcDelayS} from "batcher/stalefish.js";
import {FindBestServer} from "tools/best-target.js";

const W1 = 0;
const W2 = 1;
const G = 2;
const H = 3;
const scripts = ["weaken.js", "weaken.js", "grow.js", "hack.js"];

export class Scheduler {
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
				task.run(task, now);
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
	constructor(ns, hackPct) {
		/** @type {import("../").NS} */
		this.ns = ns;
		this.server = FindBestServer(ns, 1);
		this.hackPct = hackPct;
		this.level = ns.getHackingLevel();
		this.levelMax = this.level + HACK_LEVEL_RANGE;
		this.createdAt = performance.now();
		this.ran = 0;
		this.scheduler = new Scheduler();
		this.batches = new Map();
		// 0 = preparing, 1 = running, 2 = stopping
		this.stage = 0;
		this.invalidated = false;

		const {period, depth} = CalcPeriodDepth(ns, this.server, hackPct);

		this.period = period;
		this.depth = depth;
		this.AdjustForLevel();
		ns.print(`${DEFAULT_COLOR}[-] Batching on "${this.server}" x${depth}.`);
	}

	GetColor(id) {
		return CONSOLE_COLORS[id % CONSOLE_COLORS.length];
	}

	GetName(which) {
		switch(which) {
			case W1:
			case W2:
				return "Weaken";
			case G:
				return "Grow";
			case H:
				return "Hack";
		}
	}

	EndOrder(which) {
		switch(which) {
			case H:
				return "1";
			case W1:
				return "2";
			case G:
				return "3";
			case W2:
				return "4";
		}
	}

	AdjustForLevel() {
		this.threads = GetThreads(this.ns, this.server, this.hackPct);
		this.delays = CalcDelayS(this.ns, this.server, this.period, this.depth);
		this.scheduler.AdjustDelays(this.delays);
	}

	StartPreparing() {
		const server = this.ns.getServer(this.server);
		const pids = [];

		if(server.hackDifficulty > server.minDifficulty) {
			const threads = GetWeakThreads(this.ns, this.server);
			const sec = this.ns.nFormat(server.hackDifficulty, "0[.00]");
			const minSec = this.ns.nFormat(server.minDifficulty, "0[.00]");

			this.ns.print(`${DEFAULT_COLOR}[!] ${sec}/${minSec} security.`);
			pids.push(...RunScript(this.ns, "weaken.js", this.server, threads, true));
		}else if(server.moneyAvailable < server.moneyMax) {
			const threads = GetGrowThreads(this.ns, this.server, null, false);
			const money = this.ns.nFormat(server.moneyAvailable, "$0[.00]a");
			const moneyMax = this.ns.nFormat(server.moneyMax, "$0[.00]a");

			this.ns.print(`${DEFAULT_COLOR}[!] ${money}/${moneyMax} money.`);
			pids.push(...RunScript(this.ns, "grow.js", this.server, threads, true));
		}

		this.preparing = pids;
	}

	Prepare() {
		const server = this.ns.getServer(this.server);

		if(server.hackDifficulty === server.minDifficulty && server.moneyAvailable === server.moneyMax) {
			this.stage = 1;
			this.ns.print(`${DEFAULT_COLOR}[-] Preparations completed.`);
		}else if(this.preparing == null || CheckPids(this.ns, this.preparing)) {
			this.StartPreparing();
		}
	}

	Stop() {
		this.stage = 2;
		this.scheduler.Clear();
	}

	CancelBatch(id, which, diff) {
		const batch = this.batches.get(id);

		if(which === W2 || which === G) {
			this.scheduler.Delete(batch.pending[G]);
			batch.finished[G] = true;
		}

		this.scheduler.Delete(batch.pending[H]);
		batch.finished[H] = true;

		if(!batch.cancelled) {
			batch.cancelled = true;
			this.ns.print(`${DEFAULT_COLOR}[!] Batch ${id + 1} cancelled (${diff}).`);
		}

		return which !== W1 && which !== W2;
	}

	StartBatch(now) {
		const id = this.ran;
		const batch = {pending: [], pids: [], finished: Array(4).fill(false)};

		for(let i = W1; i <= H; i++) {
			const which = i;

			batch.pending[which] = this.scheduler.Schedule(which, now, this.delays[which], (task, at) => {
				const lateBy = at - task.createdAt + task.delay;
				const aboveMinSec = which !== W1 && which !== W2
					&& this.ns.getServerMinSecurityLevel(this.server) < this.ns.getServerSecurityLevel(this.server);

				if((lateBy >= SAFETY_THRESHOLD || aboveMinSec) && this.CancelBatch(id, which, aboveMinSec || lateBy))
					return;

				batch.pids[which] = RunScript(this.ns, scripts[which], this.server, this.threads[which]);
			});
		}

		this.batches.set(id, batch);
		++this.ran;
	}

	HandleCompletedBatches() {
		for(const [id, batch] of this.batches.entries()) {
			const color = this.GetColor(id);

			for(let i = W1; i <= H; i++) {
				if(batch.pids[i] != null && !batch.finished[i] && CheckPids(this.ns, batch.pids[i])) {
					batch.finished[i] = true;
					this.ns.print(`${color}[${this.EndOrder(i)}] ${this.GetName(i)} x${this.threads[i]} finished.`);
				}
			}

			if(batch.finished.every(f => f)) {
				this.batches.delete(id);

				if(!batch.cancelled)
					this.ns.print(`${color}[-] Batch ${id + 1} completed.`);
			}
		}
	}

	Run() {
		const now = performance.now();
		const level = this.ns.getHackingLevel();
		const nextBatchAt = this.createdAt + (this.period * this.ran);

		if(level !== this.level) {
			if(level > this.levelMax)
				return this.Stop();

			this.AdjustForLevel();
			this.level = level;
		}

		if(this.ran === 0 && nextBatchAt <= now)
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
	ns.tail();

	const ram = new RAM(ns);
	let last = performance.now();

	if(ram.free < CHAIN_VIABLE_THRESHOLD)
		return ns.tprint(`Not at ${ns.nFormat(CHAIN_VIABLE_THRESHOLD * 1e9, "0.00b")} of available RAM yet!`);
	else if(!ns.fileExists("Formulas.exe"))
		return ns.tprint("Missing Formulas.exe, which is required!");

	const hackPct = ns.args[0] ?? MONEY_PER_HACK;
	let batcher = new Batcher(ns, hackPct);

	while(true) {
		const now = performance.now();
		const delta = now - last;

		last = now;

		if(batcher.Stopped()) {
			ns.print(`${DEFAULT_COLOR}[-] Batcher is restarting.`);
			batcher = new Batcher(ns, hackPct);
		}

		batcher.Update();
		ns.print(delta);
		await ns.sleep(5);
	}
}