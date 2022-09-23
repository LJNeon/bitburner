import {
	IDS, SAFETY_THRESHOLD, HACK_LEVEL_RANGE, CHAIN_PORT,
	DEFAULT_COLOR, SUCCESS_COLOR, FAILURE_COLOR, WARNING_COLOR
} from "utility/constants.js";
import {CheckPids, nFormat} from "utility/generic.js";
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
	constructor(ns, metrics, first) {
		this.createdAt = performance.now();
		/** @type {import("../").NS} */
		this.ns = ns;
		this.server = metrics.target;
		this.hackPct = metrics.pct;
		this.period = metrics.period;
		this.depth = metrics.depth;
		this.level = ns.getPlayer().skills.hacking;
		this.levelMax = this.level + HACK_LEVEL_RANGE;
		this.port = ns.getPortHandle(CHAIN_PORT);
		this.port.clear();
		this.scheduler = new Scheduler();
		this.batches = new Map();
		this.ids = new Map();
		// 0 = preparing, 1 = running, 2 = stopping
		this.stage = 0;
		this.ran = 0;
		this.lastID = 0;
		this.AdjustForLevel();
		ns.print(`${SUCCESS_COLOR}[-] ${first ? "S" : "Res"}tarting...`);
		ns.print(`${SUCCESS_COLOR} ~ ${DEFAULT_COLOR}Depth     | ${metrics.depth}`);
		ns.print(`${SUCCESS_COLOR} ~ ${DEFAULT_COLOR}Hack %    | ${Math.floor(metrics.pct * 100)}%`);
		ns.print(`${SUCCESS_COLOR} ~ ${DEFAULT_COLOR}Max Level | ${nFormat(this.levelMax, "l")}`);
		ns.print(`${SUCCESS_COLOR} ~ ${DEFAULT_COLOR}Duration  | ${ns.tFormat(metrics.period * metrics.depth)}`);
	}

	GetID() {
		return this.lastID = (this.lastID + 1) % Number.MAX_SAFE_INTEGER;
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
			const sec = nFormat(server.hackDifficulty, "l", 2);
			const minSec = nFormat(server.minDifficulty, "l", 2);

			this.ns.print(`${WARNING_COLOR}[?] ${sec}/${minSec} security.`);
			pids.push(...RunScript(this.ns, "weaken.js", this.server, threads, true, true));
		}else if(server.moneyAvailable < server.moneyMax) {
			const threads = GetGrowThreads(this.ns, server, this.ns.getPlayer());
			const money = nFormat(server.moneyAvailable);
			const moneyMax = nFormat(server.moneyMax);

			this.ns.print(`${WARNING_COLOR}[?] $${money}/$${moneyMax} money.`);
			pids.push(...RunScript(this.ns, "grow.js", this.server, threads, false, true));
		}

		this.preparing = pids;
	}

	Prepare() {
		const server = this.ns.getServer(this.server);

		if(server.hackDifficulty === server.minDifficulty && server.moneyAvailable === server.moneyMax) {
			this.stage = 1;
			this.ns.print(`${SUCCESS_COLOR}[-] Preparations complete.`);
		}else if(this.preparing == null || CheckPids(this.ns, this.preparing)) {
			this.StartPreparing();
		}
	}

	Stop() {
		this.stage = 2;
	}

	CancelTask(id, which, diff) {
		const batch = this.batches.get(id);

		if(which === IDS.W2 || which === IDS.G)
			this.scheduler.Delete(batch.scheduled[IDS.G]);

		this.scheduler.Delete(batch.scheduled[IDS.H]);

		if(!batch.partial) {
			batch.partial = true;
			this.ns.print(`${FAILURE_COLOR}[!] Batch ${id + 1} cancelled (${diff === true ? diff : diff.toFixed(2)}).`);
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

				if((lateBy >= SAFETY_THRESHOLD || unpreped) && this.CancelTask(batchID, which, unpreped || lateBy))
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
			const which = batch.running[id];

			if(!batch.partial) {
				if(which === IDS.H && Object.keys(batch.running).length !== 4)
					this.ns.print(`${FAILURE_COLOR}[!] Batch ${batchID + 1}'s H finished out of order.`);
				else if(which === IDS.W1 && Object.keys(batch.running).length !== 3)
					this.ns.print(`${FAILURE_COLOR}[!] Batch ${batchID + 1}'s W1 finished out of order.`);
				else if(which === IDS.G && Object.keys(batch.running).length !== 2)
					this.ns.print(`${FAILURE_COLOR}[!] Batch ${batchID + 1}'s G finished out of order.`);
				else if(which === IDS.W2 && Object.keys(batch.running).length !== 1)
					this.ns.print(`${FAILURE_COLOR}[!] Batch ${batchID + 1}'s W2 finished out of order.`);
			}

			delete batch.running[id];
			this.ids.delete(id);
		}

		for(const [id, batch] of this.batches.entries()) {
			if(batch.scheduled.every(s => !this.scheduler.Has(s)) && Object.keys(batch.running).length === 0)
				this.batches.delete(id);

		}
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

		this.scheduler.Run(now);
		this.ReadPort();
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
				this.scheduler.Run(performance.now());
				this.ReadPort();

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
		return ns.tprint(`${FAILURE_COLOR}Server "${target}" doesn't exist.`);
	}

	let metrics = await GetHackPercent(ns, target);

	if(metrics.pct === 0)
		return ns.tprint(`${FAILURE_COLOR}[!] Not enough free RAM for batching on "${target}".`);

	let batcher = new Batcher(ns, metrics, true);

	while(true) {
		if(batcher.Stopped()) {
			metrics = await GetHackPercent(ns, target);

			if(metrics.pct === 0) {
				ns.print(`${FAILURE_COLOR}[!] Not enough free RAM, exiting...`);

				break;
			}

			batcher = new Batcher(ns, metrics, false);
		}

		batcher.Update();
		await ns.sleep(5);
	}
}