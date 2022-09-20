import {
	WEAKEN_GROW_RAM, HACK_RAM, SEC_PER_THREAD, MONEY_PER_HACK,
	HACK_LEVEL_RANGE, TARGET_UPDATE_RATE, FOCUS_SMALL_THRESHOLD, DEFAULT_COLOR,
	CONSOLE_COLORS
} from "constants.js";
import RAM from "batcher/ram.js";
import {CalcPeriodDepth, CalcDelays} from "batcher/stalefish.js";
import FindBestServer from "tools/best-target.js";
import {
	GenID, CheckPids, GetWeakThreads, GetGrowThreads,
	GetHackThreads, GetBatchRam
} from "utility.js";

/** @param {import("../").NS} ns */
function RunScript(ns, script, server, threadCount, partial = false) {
	const ram = new RAM(ns);
	const threadRam = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const spread = script === "weaken.js";
	const pids = [];
	let hosted = 0;

	while(hosted < threadCount) {
		const freeRam = ram.total <= FOCUS_SMALL_THRESHOLD ? ram.Smallest(threadRam * threadCount) : ram.Largest();
		let threads = Math.floor(freeRam / threadRam);

		if(threads === 0)
			break;
		else if(threads > threadCount - hosted)
			threads = threadCount - hosted;
		else if(!spread && threads !== threadCount)
			break;

		const host = ram.Reserve(freeRam);

		if(host == null) {
			if(!(spread && partial))
				break;
			else
				continue;
		}

		const pid = ns.exec(script, host, threads, server, GenID());

		if(pid !== 0) {
			pids.push(pid);
			hosted += threads;

			if(hosted >= threadCount)
				break;
		}
	}

	if(!partial && hosted < threadCount) {
		pids.forEach(pid => ns.kill(pid));

		return [];
	}

	return pids;
}

/** @param {import("../").NS} ns */
function Weaken(ns, server, securityLevel, partial = false) {
	const threads = GetWeakThreads(ns, server, securityLevel);

	return RunScript(ns, "weaken.js", server, threads, partial);
}

/** @param {import("../").NS} ns */
function Grow(ns, server, moneyAvailable, partial = false) {
	const threads = GetGrowThreads(ns, server, moneyAvailable);

	return RunScript(ns, "grow.js", server, threads, partial);
}

/** @param {import("../").NS} ns */
function Hack(ns, server, hackPct, partial = false) {
	const threads = GetHackThreads(ns, server, hackPct);

	return RunScript(ns, "hack.js", server, threads, partial);
}

/** @param {import("../").NS} ns */
function IsPrepared(ns, target) {
	const server = ns.getServer(target);

	return server.moneyAvailable >= server.moneyMax && server.hackDifficulty <= server.minDifficulty;
}

/** @param {import("../").NS} ns */
function Prepare(ns, target) {
	const server = ns.getServer(target);
	const pids = [];

	if(server.hackDifficulty > server.minDifficulty) {
		const sec = ns.nFormat(ns, server.hackDifficulty, "0[.00]");
		const minSec = ns.nFormat(ns, server.minDifficulty, "0[.00]");

		ns.print(`${DEFAULT_COLOR}[!] ${sec}/${minSec} security for "${target}".`);
		pids.push(...Weaken(ns, target, server.hackDifficulty, true));
	}

	if(server.moneyAvailable < server.moneyMax) {
		const money = ns.nFormat(ns, server.moneyAvailable, "$0.00a");
		const moneyMax = ns.nFormat(ns, server.moneyMax, "$0.00a");

		ns.print(`${DEFAULT_COLOR}[!] ${money}/${moneyMax} money for "${target}".`);
		pids.push(...Grow(ns, target, server.moneyAvailable, true));
	}

	return pids;
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const hackPct = ns.args[0] ?? MONEY_PER_HACK;
	let targets = {server: FindBestServer(ns, 1), prepared: false};
	const preparing = new Map();
	let updatedTargets = performance.now();
	let batcher;

	while(true) {
		const now = performance.now();
		const unprepared = targets.prepared ? [] : [targets.server];

		if(now - updatedTargets >= TARGET_UPDATE_RATE) {
			targets = {server: FindBestServer(ns, 1), prepared: false};
			updatedTargets = now;
			ns.print(`${DEFAULT_COLOR}[!] Updated target servers.`);
		}

		for(const server of unprepared) {
			if(preparing.has(server)) {
				if(CheckPids(ns, preparing.get(server)))
					continue;

				preparing.delete(server);
				targets.prepared = true;
			}else if(!IsPrepared(ns, server)) {
				preparing.set(server, Prepare(ns, server));
			}else{
				const target = targets;

				if(!target.prepared)
					target.prepared = true;
			}
		}

		if(batcher == null) {
			const server = targets.prepared ? targets.server : null;

			if(server == null) {
				await ns.sleep(5);

				continue;
			}

			batcher = new Batcher(ns, server, hackPct, now);
		}

		if(batcher.Update(now)) {
			const server = targets;

			if(server != null)
				server.prepared = false;

			batcher = null;
		}

		await ns.sleep(5);
	}
}

class Batcher {
	constructor(ns, server, hackPct, now) {
		/** @type {import("../").NS} ns */
		this.ns = ns;
		this.server = server;
		this.hackingLevel = ns.getHackingLevel();
		this.hackingLevelMax = this.hackingLevel + HACK_LEVEL_RANGE;
		this.hackPct = hackPct;
		this.startAt = now;
		this.ran = 0;
		this.stopping = false;
		this.tasks = [];

		const maxMoney = ns.getServerMaxMoney(server);
		const stalefish = CalcPeriodDepth(ns, server, hackPct);
		const batchRam = ns.nFormat(ns, GetBatchRam(ns, server, hackPct) * 1e9, "0.00b");

		this.moneyAfterHack = maxMoney - (maxMoney * hackPct);
		this.period = stalefish.period;
		this.depth = stalefish.depth;
		ns.print(`${DEFAULT_COLOR}[-] Now targeting "${server}" (${batchRam} x${stalefish.depth}).`);
		this.Recalibrate();
	}

	GetColor(batch) {
		return CONSOLE_COLORS[batch % CONSOLE_COLORS.length];
	}

	NumberAbbr(abbr, start = true) {
		if(start) {
			switch(abbr) {
				case "W1":
					return "1";
				case "W2":
					return "2";
				case "G":
					return "3";
				case "H":
					return "4";
			}
		}else{
			switch(abbr) {
				case "W1":
					return "2";
				case "W2":
					return "4";
				case "G":
					return "3";
				case "H":
					return "1";
			}
		}
	}

	Recalibrate() {
		const growSecCost = GetGrowThreads(this.ns, this.server, this.moneyAfterHack) * SEC_PER_THREAD.GROW;
		const hackSecCost = GetHackThreads(this.ns, this.server, this.hackPct) * SEC_PER_THREAD.HACK;
		const minSec = this.ns.getServerMinSecurityLevel(this.server);

		this.postGrowSecurity = minSec + growSecCost;
		this.postHackSecurity = minSec + hackSecCost;
		this.delays = CalcDelays(this.ns, this.server, this.period, this.depth);
	}

	TaskReady(task, now) {
		return task.startAt + this.delays[task.abbr] <= now;
	}

	AllTasksDone() {
		for(const task of this.tasks) {
			if(task.pids != null && !CheckPids(this.ns, task.pids))
				return false;
		}

		return true;
	}

	BatchCompleted(task) {
		for(const otherTask of this.tasks) {
			if(otherTask.batch === task.batch && otherTask.pids !== task.pids)
				return false;
		}

		return true;
	}

	CreateTask(abbr, now, callback) {
		this.tasks.push({
			batch: this.ran,
			abbr,
			startAt: now,
			callback
		});
	}

	RunTask(i) {
		const task = this.tasks[i];
		const pids = task.callback();

		if(pids.length === 0) {
			if(task.abbr === "H") {
				this.tasks.splice(i, 1);
				this.ns.print(`${this.GetColor(task.batch)}[4] H failed to start.`);
			}else{
				for(let j = 0; j < this.tasks.length; j++) {
					if(this.tasks[j].batch === task.batch) {
						if(this.tasks[j].pids != null)
							this.tasks[j].pids.forEach(pid => this.ns.kill(pid));

						this.tasks.splice(j--, 1);
					}
				}

				this.ns.print(`${this.GetColor(task.batch)}[!] Batch #${task.batch + 1} cancelled (${task.abbr} failed).`);
			}
		}else{
			if(this.ns.getServerMinSecurityLevel(this.server) !== this.ns.getServerSecurityLevel(this.server))
				this.ns.print(`${DEFAULT_COLOR}[!] Uh oh! Task started above min security..`);

			this.tasks[i].pids = pids;
		}
	}

	Update(now) {
		if(this.stopping)
			return this.AllTasksDone();

		const hackingLevel = this.ns.getHackingLevel();

		if(this.hackingLevel !== hackingLevel) {
			if(this.hackingLevelMax < hackingLevel) {
				this.stopping = true;

				for(let i = 0; i < this.tasks.length; i++) {
					if(this.tasks[i].pid == null)
						this.tasks.splice(i--, 1);
				}

				return true;
			}

			this.Recalibrate();
			this.hackingLevel = hackingLevel;
		}

		if(this.startAt + (this.period * this.ran) <= now) {
			this.CreateTask("W1", now, () => Weaken(this.ns, this.server, this.postHackSecurity, false));
			this.CreateTask("W2", now, () => Weaken(this.ns, this.server, this.postGrowSecurity, true));
			this.CreateTask("G", now, () => Grow(this.ns, this.server, this.moneyAfterHack));
			this.CreateTask("H", now, () => Hack(this.ns, this.server, this.hackPct));
			++this.ran;
		}

		for(let i = 0; i < this.tasks.length; i++) {
			const task = this.tasks[i];

			if(task.pids == null) {
				if(this.TaskReady(task, now))
					this.RunTask(i);
			}else if(CheckPids(this.ns, task.pids)) {
				this.ns.print(`${this.GetColor(task.batch)}[${this.NumberAbbr(task.abbr, false)}] ${task.abbr} ended.`);

				if(this.BatchCompleted(task))
					this.ns.print(`${this.GetColor(task.batch)}[-] Batch #${task.batch + 1} completed.`);

				this.tasks.splice(i--, 1);
			}
		}

		return false;
	}
}