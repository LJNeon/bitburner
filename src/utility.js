import {
	WEAKEN_GROW_RAM, HACK_RAM, SEC_PER_THREAD, WEAKEN_GROW_EXTRA
} from "constants.js";

/** @param {import(".").NS} ns */
export function GenID(ns) {
	const ids = ns.getPurchasedServers().map(s => s.slice(s.lastIndexOf("-") + 1));
	let id = Math.random().toString(16).slice(-6);

	while(ids.includes(id))
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
	const logD = Log1Exp(-0.7875514895451805 + logZ);
	let w = (2.036 * (logN - logD)) - 1;

	w *= (logXE - Math.log(w)) / (1 + w);
	w *= (logXE - Math.log(w)) / (1 + w);
	w *= (logXE - Math.log(w)) / (1 + w);

	return isNaN(w) ? logXE < 0 ? 0 : Infinity : w;
}

/** @param {import(".").NS} ns */
function GrowPercent(ns, host, threads = 1, cores = 1, opts = {}) {
	const {ServerGrowthRate = 1, hackDifficulty = ns.getServerSecurityLevel(host)} = opts;
	const growth = ns.getServerGrowth(host) / 100;
	const multiplier = ns.getPlayer().mults.hacking_grow;
	const base = Math.min(1 + (0.03 / hackDifficulty), 1.0035);
	const power = growth * ServerGrowthRate * multiplier * ((cores + 15) / 16);

	return base ** (power * threads);
}

/** @param {import(".").NS} ns */
export function CalcGrowThreadsL(ns, host, gain, cores = 1, opts = {}) {
	const moneyMax = ns.getServerMaxMoney(host);
	const {moneyAvailable = ns.getServerMoneyAvailable(host)} = opts;
	const money = Math.min(Math.max(moneyAvailable + gain, 0), moneyMax);
	const rate = Math.log(GrowPercent(ns, host, 1, cores, opts));
	const logX = Math.log(money * rate) + (moneyAvailable * rate);
	const threads = (LambertWLog(logX) / rate) - moneyAvailable;

	return Math.max(Math.ceil(threads), 0);
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
export function GetWeakThreads(ns, target, securityLevel, cores = 1) {
	const server = ns.getServer(target);
	const sec = securityLevel ?? server.hackDifficulty;

	return Math.ceil((sec - server.minDifficulty) / ns.weakenAnalyze(1, cores) * WEAKEN_GROW_EXTRA);
}
/** @param {import(".").NS} ns */
export function GetGrowThreads(ns, target, moneyAvailable, cores = 1) {
	const server = ns.getServer(target);

	if(moneyAvailable != null)
		server.moneyAvailable = moneyAvailable;

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
export function GetBatchThreads(ns, target, hackPct) {
	const server = ns.getServer(target);
	const growThreads = GetGrowThreads(ns, target, server.moneyMax * hackPct);
	const hackThreads = GetHackThreads(ns, target, hackPct);

	return {
		H: hackThreads,
		W1: Math.ceil((hackThreads * SEC_PER_THREAD.HACK) / SEC_PER_THREAD.WEAKEN),
		G: growThreads,
		W2: Math.ceil((growThreads * SEC_PER_THREAD.GROW) / SEC_PER_THREAD.WEAKEN)
	};
}
/** @param {import(".").NS} ns */
export function GetThreads(ns, target, hackPct) {
	const server = ns.getServer(target);
	const hackThreads = GetHackThreads(ns, target, hackPct);
	const growThreads = GetGrowThreads(ns, target, server.moneyMax * hackPct);

	return [
		Math.ceil((hackThreads * SEC_PER_THREAD.HACK) / SEC_PER_THREAD.WEAKEN),
		Math.ceil((growThreads * SEC_PER_THREAD.GROW) / SEC_PER_THREAD.WEAKEN),
		growThreads,
		hackThreads
	];
}
/** @param {import(".").NS} ns */
export function GetBatchRam(ns, target, hackPct) {
	const threads = GetBatchThreads(ns, target, hackPct);

	return (HACK_RAM * threads.H) + (WEAKEN_GROW_RAM * (threads.W1 + threads.G + threads.W2));
}