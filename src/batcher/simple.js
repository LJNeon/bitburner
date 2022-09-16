import {ScanAll, SleepPids, CalcGrowThreadsL} from "utility.js";
import {
	HACK_RAM, WEAKEN_GROW_RAM, MONEY_PER_HACK, SAFETY_DELAY
} from "constants.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const target = ns.args[0];
	const pctMoneyPerHack = ns.args[1] ?? MONEY_PER_HACK;

	while(true) {
		await Prepare(ns, target);

		const hackingLevel = ns.getHackingLevel();
		const weakenT = ns.getWeakenTime(target);
		const growT = ns.getGrowTime(target);
		const hackT = ns.getHackTime(target);
		const moneyPerHack = ns.getServerMaxMoney(target) * pctMoneyPerHack;
		const growThreads = CalcGrowThreadsL(
			ns,
			target,
			moneyPerHack,
			1,
			{moneyAvailable: ns.getServerMaxMoney(target) - moneyPerHack}
		);
		let hackThreads = Math.floor(ns.hackAnalyzeThreads(target, moneyPerHack));
		const hackWeakenThreads = Math.ceil(ns.hackAnalyzeSecurity(hackThreads) / ns.weakenAnalyze(1));
		const growWeakenThreads = Math.ceil(ns.growthAnalyzeSecurity(growThreads) / ns.weakenAnalyze(1));
		const pids = [];
		let result = RunScript(ns, "weaken.js", target, hackWeakenThreads);
		let adjustedT = 0;
		let finished = true;

		if(result.hosted === hackWeakenThreads) {
			ns.print(`[1] weaken.js x${hackWeakenThreads} started.`);
			pids.push(...result.pids);
			SleepPids(ns, result.pids).then(() => {
				if(finished)
					ns.print(`[2] weaken.js x${hackWeakenThreads} finished.`);
			});
		}else{
			ns.print(`[!] weaken.js (1) x${hackWeakenThreads} failed. Waiting 60s...`);
			await ns.asleep(6e4);

			continue;
		}

		await ns.asleep(SAFETY_DELAY * 2);

		if(ns.getHackingLevel() !== hackingLevel) {
			const extraT = weakenT - ns.getWeakenTime(target);

			adjustedT += extraT;
			await ns.asleep(extraT);
		}

		result = RunScript(ns, "weaken.js", target, growWeakenThreads);

		if(result.hosted === growWeakenThreads) {
			ns.print(`[2] weaken.js x${growWeakenThreads} started.`);
			pids.push(...result.pids);
			SleepPids(ns, result.pids).then(() => {
				if(finished)
					ns.print(`[4] weaken.js x${growWeakenThreads} finished.`);
			});
		}else{
			ns.print(`[!] weaken.js (2) x${growWeakenThreads} failed. Waiting 60s...`);
			finished = false;
			ScanAll(ns).forEach(s => ns.kill("weaken.js", s, target));
			await ns.asleep(6e4);

			continue;
		}

		await ns.asleep(weakenT - growT - SAFETY_DELAY - adjustedT);

		if(ns.getHackingLevel() !== hackingLevel) {
			const extraT = growT - ns.getGrowTime(target);

			adjustedT += extraT;
			await ns.asleep(extraT);
		}

		result = RunScript(ns, "grow.js", target, growThreads);

		if(result.hosted === growThreads) {
			ns.print(`[3] grow.js x${growThreads} started.`);
			pids.push(...result.pids);
			SleepPids(ns, result.pids).then(() => {
				if(finished)
					ns.print(`[3] grow.js x${growThreads} finished.`);
			});
		}else{
			ns.print(`[!] grow.js x${growThreads} failed. Waiting 60s...`);
			finished = false;
			ScanAll(ns).forEach(s => {
				ns.kill("weaken.js", s, target);
				ns.kill("grow.js", s, target);
			});
			await ns.asleep(6e4);

			continue;
		}

		await ns.asleep(growT - hackT - (SAFETY_DELAY * 2) - adjustedT);

		if(ns.getHackingLevel() !== hackingLevel) {
			const extraT = ns.nFormat(hackT - ns.getHackTime(target), "0.00");

			await ns.asleep(extraT);
			hackThreads = Math.floor(ns.hackAnalyzeThreads(target, moneyPerHack));
		}

		result = RunScript(ns, "hack.js", target, hackThreads);

		if(result.hosted === hackThreads) {
			ns.print(`[4] hack.js x${hackThreads} started.`);
			pids.push(...result.pids);
			SleepPids(ns, result.pids).then(() => {
				if(finished)
					ns.print(`[1] hack.js x${hackThreads} finished.`);
			});
		}else{
			ns.print(`[!] hack.js x${hackThreads} failed. Waiting 60s...`);
			finished = false;
			ScanAll(ns).forEach(s => {
				ns.kill("weaken.js", s, target);
				ns.kill("grow.js", s, target);
				ns.kill("hack.js", s, target);
			});
			await ns.asleep(6e4);

			continue;
		}

		await SleepPids(ns, pids);
		await ns.asleep(SAFETY_DELAY);
		ns.print("[-] Batch completed!");
	}
}

/** @param {import("../").NS} ns */
function GetFreeRam(ns, server) {
	return ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
}

/** @param {import("../").NS} ns */
function RunScript(ns, script, target, threads, single = false) {
	const list = ScanAll(ns).filter(p => ns.hasRootAccess(p) && ns.getServerMaxRam(p) > 0);
	const threadRam = script === "hack.js" ? HACK_RAM : WEAKEN_GROW_RAM;
	const pids = [];
	let hosted = 0;

	list.sort((a, b) => GetFreeRam(ns, b) - GetFreeRam(ns, a));

	for(const host of list) {
		const freeRam = GetFreeRam(ns, host);
		let threadCount = Math.floor(freeRam / threadRam);

		if(threadCount === 0)
			continue;
		else if(threadCount > threads - hosted)
			threadCount = threads - hosted;
		else if(single && threadCount !== threads)
			break;

		const pid = ns.exec(script, host, threadCount, target, Math.random().toString(16).slice(-6));

		if(pid !== 0) {
			pids.push(pid);
			hosted += threadCount;

			if(hosted >= threads)
				break;
		}
	}

	return {hosted, pids};
}

/** @param {import("../").NS} ns */
async function Prepare(ns, target) {
	while(true) {
		const atMinSecurity = ns.getServerMinSecurityLevel(target) === ns.getServerSecurityLevel(target);
		const atMaxMoney = ns.getServerMaxMoney(target) === ns.getServerMoneyAvailable(target);

		if(atMinSecurity && atMaxMoney)
			break;

		const pids = [];

		if(!atMinSecurity) {
			const minSec = ns.getServerMinSecurityLevel(target);
			const sec = ns.getServerSecurityLevel(target);
			const threads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1));

			ns.print(`[!] ${ns.nFormat(sec, "(0.00)")} security level, desired is ${ns.nFormat(minSec, "(0.00)")}.`);
			pids.push(...RunScript(ns, "weaken.js", target, threads).pids);
		}

		if(!atMaxMoney) {
			const money = ns.getServerMoneyAvailable(target);
			const maxMoney = ns.getServerMaxMoney(target);
			const threads = CalcGrowThreadsL(ns, target, maxMoney - money);

			ns.print(`[!] ${ns.nFormat(money, "$0.00a")}/${ns.nFormat(maxMoney, "$0.00a")} money held.`);
			pids.push(...RunScript(ns, "grow.js", target, threads).pids);
		}

		await SleepPids(ns, pids);
	}
}