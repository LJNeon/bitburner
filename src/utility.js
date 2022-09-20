import {
	WEAKEN_GROW_RAM, HACK_RAM, IDS, SEC_PER_THREAD,
	WEAKEN_GROW_EXTRA
} from "constants.js";

/** @param {import(".").NS} ns */
export function GenID(existing = []) {
	let id = Math.random().toString(16).slice(-6);

	while(existing.includes(id))
		id = Math.random().toString(16).slice(-6);

	return id;
}
/** @param {import(".").NS} ns */
export function ScanAll(ns, root = "home", found = new Set()) {
	found.add(root);

	for(const server of ns.scan(root)) {
		if(!found.has(server))
			ScanAll(ns, server, found);
	}

	return Array.from(found.values());
}
/** @param {import(".").NS} ns */
export function CheckPids(ns, pids) {
	return pids.every(pid => ns.getRunningScript(pid) == null);
}
/** @param {import(".").NS} ns */
export async function SleepPids(ns, pids) {
	while(!CheckPids(ns, pids))
		await ns.asleep(5);
}

function Log1Exp(x) {
	return x <= 0 ? Math.log(1 + Math.exp(x)) : x + Log1Exp(-x);
}

function LambertWLog(logX) {
	if(isNaN(logX))
		return NaN;

	const logXE = logX + 1;
	const logY = 0.5 * Log1Exp(logXE);
	const logZ = Math.log(Log1Exp(logY));
	const logN = Log1Exp(0.13938040121300527 + logY);
	const logD = Log1Exp(logZ - 0.7875514895451805);
	let w = (2.036 * (logN - logD)) - 1;

	w *= (logXE - Math.log(w)) / (1 + w);
	w *= (logXE - Math.log(w)) / (1 + w);
	w *= (logXE - Math.log(w)) / (1 + w);

	return isNaN(w) ? logXE < 0 ? 0 : Infinity : w;
}

/** @param {import(".").NS} ns */
function GrowPercent(ns, server, threads = 1, opts = {}) {
	const {hackDifficulty = server.hackDifficulty} = opts;
	const growth = server.serverGrowth / 100;
	const multiplier = ns.getPlayer().mults.hacking_grow;
	const base = Math.min(1 + (0.03 / hackDifficulty), 1.0035);
	// TODO: FIX!!!
	const power = growth * 0.2/* ns.getBitNodeMultipliers().ServerGrowthRate */ * multiplier;

	return base ** (power * threads);
}

/** @param {import(".").NS} ns */
export function CalcGrowThreadsL(ns, host, gain, opts = {}) {
	const server = ns.getServer(host);
	const {moneyMax} = server;
	const {moneyAvailable = server.moneyAvailable} = opts;
	const money = Math.min(Math.max(moneyAvailable + gain, 0), moneyMax);
	const rate = Math.log(GrowPercent(ns, server, 1, opts));
	const logX = Math.log(money * rate) + (moneyAvailable * rate);
	const threads = (LambertWLog(logX) / rate) - moneyAvailable;

	return Math.max(Math.ceil(threads), 0);
}
/** @param {import(".").NS} ns */
export function CalcHackThreadsL(ns, target, hackPct) {
	const money = ns.getServer(target).moneyMax * hackPct;

	return Math.floor(ns.hackAnalyzeThreads(target, money));
}
/** @param {import(".").NS} ns */
export function CalcGrowThreads(ns, serverObj, playerObj, cores = 1) {
	let threads = 1;

	while(true) {
		const serverGrowth = ns.formulas.hacking.growPercent(serverObj, threads, playerObj, cores);
		const newMoney = (serverObj.moneyAvailable + threads) * serverGrowth;

		if(newMoney >= serverObj.moneyMax)
			break;

		++threads;
	}

	return threads;
}
/** @param {import(".").NS} ns */
export function GetWeakThreads(threads, gain) {
	return Math.ceil((threads * gain) / SEC_PER_THREAD.WEAKEN * WEAKEN_GROW_EXTRA);
}
/** @param {import(".").NS} ns */
export function GetGrowThreads(ns, target, money, minDifficulty = true, cores = 1) {
	const server = ns.getServer(target);

	if(money != null)
		server.moneyAvailable = money;

	if(minDifficulty)
		server.hackDifficulty = server.minDifficulty;

	return Math.ceil(CalcGrowThreads(ns, server, ns.getPlayer(), cores) * WEAKEN_GROW_EXTRA);
}
/** @param {import(".").NS} ns */
export function GetHackThreads(ns, target, hackPct) {
	const server = ns.getServer(target);

	server.hackDifficulty = server.minDifficulty;

	return Math.floor(hackPct / ns.formulas.hacking.hackPercent(server, ns.getPlayer()));
}
/** @param {import(".").NS} ns */
export function GetThreadsL(ns, target, hackPct) {
	const server = ns.getServer(target);
	const gains = server.moneyMax * hackPct;
	const hackThreads = CalcHackThreadsL(ns, target, hackPct);
	const growThreads = CalcGrowThreadsL(ns, target, gains, {moneyAvailable: server.moneyMax - gains});

	return [
		GetWeakThreads(hackThreads, SEC_PER_THREAD.HACK),
		GetWeakThreads(growThreads, SEC_PER_THREAD.GROW),
		Math.ceil(growThreads * WEAKEN_GROW_EXTRA),
		hackThreads
	];
}
/** @param {import(".").NS} ns */
export function GetThreads(ns, target, hackPct) {
	const server = ns.getServer(target);
	const hackThreads = GetHackThreads(ns, target, hackPct);
	const growThreads = GetGrowThreads(ns, target, server.moneyMax * hackPct);

	return [
		GetWeakThreads(hackThreads, SEC_PER_THREAD.HACK),
		GetWeakThreads(growThreads, SEC_PER_THREAD.GROW),
		growThreads,
		hackThreads
	];
}
export function GetBatchRamL(ns, target, hackPct) {
	const threads = GetThreadsL(ns, target, hackPct);

	return (HACK_RAM * threads[IDS.H]) + (WEAKEN_GROW_RAM * (threads[IDS.W1] + threads[IDS.W2] + threads[IDS.G]));
}
/** @param {import(".").NS} ns */
export function GetBatchRam(ns, target, hackPct) {
	const threads = GetThreads(ns, target, hackPct);

	return (HACK_RAM * threads[IDS.H]) + (WEAKEN_GROW_RAM * (threads[IDS.W1] + threads[IDS.W2] + threads[IDS.G]));
}