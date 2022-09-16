import {
	MONEY_PER_HACK, HACK_LEVEL_RANGE, CHAIN_VIABLE_THRESHOLD, DEFAULT_COLOR,
	CONSOLE_COLORS
} from "constants.js";
import {
	CheckPids, GetWeakThreads, GetGrowThreads, GetThreads
} from "utility.js";
import {RAM} from "batcher/ram.js";
import {RunScript} from "batcher/run-script.js";
import {CalcPeriodDepth, CalcDelayS} from "batcher/stalefish.js";
import {FindBestServer} from "tools/target.js";

const W1 = 0;
const W2 = 1;
const G = 2;
const H = 3;
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
		const id = this.GenID();

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
		for(const id of this.tasks.keys()) {
			const task = this.tasks.get(id);

			if(task.createdAt + task.delay <= now) {
				this.tasks.delete(id);
				task.run();
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
		ns.print(`${DEFAULT_COLOR}[-] Batching on "${this.server}" (x${depth} / ${ns.nFormat(period, "0[.00]")}).`);
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
		}

		if(server.moneyAvailable < server.moneyMax) {
			const threads = GetGrowThreads(this.ns, this.server);
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

	StartBatch(now) {
		const id = this.ran;
		const batch = {pending: [], pids: [], finished: Array(4).fill(false)};

		for(let i = W1; i <= H; i++) {
			const which = i;

			batch.pending[which] = this.scheduler.Schedule(which, now, this.delays[which], () => {
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
				this.ns.print(`${color}[-] Batch ${id + 1} completed.`);
			}
		}
	}

	Run() {
		const now = performance.now();
		const level = this.ns.getHackingLevel();

		if(level !== this.level) {
			if(level > this.levelMax)
				return this.Stop();

			this.AdjustForLevel();
			this.level = level;
		}

		if(this.createdAt + (this.period * this.ran) <= now)
			this.StartBatch(now);

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
				this.PrintCompletedBatches();

				break;
			default:
				if(!this.invalidated) {
					this.invalidated = true;
					this.ns.print(`${DEFAULT_COLOR}[!] Current stage is invalid!`);
				}

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

	const ram = new RAM(ns);

	if(ram.free < CHAIN_VIABLE_THRESHOLD)
		return ns.tprint("Not at 1 PB of available RAM yet!");
	else if(!ns.fileExists("Formulas.exe"))
		return ns.tprint("Missing Formulas.exe, which is required!");

	const hackPct = ns.args[0] ?? MONEY_PER_HACK;
	let batcher = new Batcher(ns, hackPct);

	while(true) {
		if(batcher.Stopped()) {
			ns.print(`${DEFAULT_COLOR}[-] Batcher is restarting.`);
			batcher = new Batcher(ns, hackPct);
		}

		batcher.Update();
		await ns.sleep(5);
	}
}