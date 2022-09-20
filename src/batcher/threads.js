/*.
 * There are two versions of most exported functions. The L version
 * is the version that doesn't use Formulas.exe, because that's an L.
.*/

import {
	HACK_RAM, WEAKEN_GROW_RAM, WEAKEN_GROW_EXTRA, IDS,
	SEC_PER_THREAD
} from "constants.js";

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

/** @param {import("../").NS} ns */
function GrowPercent(ns, host, threads = 1, opts = {}) {
	const {ServerGrowthRate = 0.2, hackDifficulty = ns.getServerSecurityLevel(host)} = opts;
	const growth = ns.getServerGrowth(host) / 100;
	const multiplier = ns.getPlayer().mults["hacking_grow"];
	const base = Math.min(1 + (0.03 / hackDifficulty), 1.0035);
	const power = growth * ServerGrowthRate * multiplier;

	return base ** (power * threads);
}

/** @param {import("../").NS} ns */
export function GetGrowThreadsL(ns, host, gain, opts = {}) {
	const moneyMax = ns.getServerMaxMoney(host);
	const {moneyAvailable = ns.getServerMoneyAvailable(host)} = opts;
	const money = Math.min(Math.max(moneyAvailable + gain, 0), moneyMax);
	const rate = Math.log(GrowPercent(ns, host, 1, opts));
	const logX = Math.log(money * rate) + (moneyAvailable * rate);
	const threads = (LambertWLog(logX) / rate) - moneyAvailable;

	return Math.max(Math.ceil(threads * WEAKEN_GROW_EXTRA), 0);
}
/** @param {import("../").NS} ns */
export function GetHackThreadsL(ns, target, hackPct) {
	return Math.floor(hackPct / ns.hackAnalyze(target));
}
/** @param {import("../").NS} ns */
export function GetWeakThreads(security) {
	return Math.ceil(security / SEC_PER_THREAD.WEAKEN * WEAKEN_GROW_EXTRA);
}
/** @param {import("../").NS} ns */
export function GetGrowThreads(ns, serverObj, playerObj) {
	if(isNaN(serverObj.moneyAvailable))
		return NaN;

	let threads = 1;

	while(true) {
		const serverGrowth = ns.formulas.hacking.growPercent(serverObj, threads, playerObj);
		const newMoney = (serverObj.moneyAvailable + threads) * serverGrowth;

		if(newMoney >= serverObj.moneyMax)
			break;

		threads++;
	}

	return Math.ceil(threads * WEAKEN_GROW_EXTRA);
}
/** @param {import("../").NS} ns */
export function GetHackThreads(ns, serverObj, playerObj, hackPct) {
	return Math.floor(hackPct / ns.formulas.hacking.hackPercent(serverObj, playerObj));
}
/** @param {import("../").NS} ns */
export function GetThreadsL(ns, target, hackPct) {
	const server = ns.getServer(target);
	const gains = server.moneyMax * hackPct;
	const hackThreads = GetHackThreadsL(ns, target, hackPct);
	const growThreads = GetGrowThreadsL(ns, target, gains, {moneyAvailable: server.moneyMax - gains});

	return [
		GetWeakThreads(hackThreads * SEC_PER_THREAD.HACK),
		GetWeakThreads(growThreads * SEC_PER_THREAD.GROW),
		growThreads,
		hackThreads
	];
}
/** @param {import("../").NS} ns */
export function GetThreads(ns, target, hackPct) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;
	server.moneyAvailable = server.moneyMax;

	const hackThreads = GetHackThreads(ns, server, player, hackPct);

	server.moneyAvailable = server.moneyMax * hackPct;

	const growThreads = GetGrowThreads(ns, target, server, player);

	return [
		GetWeakThreads(hackThreads * SEC_PER_THREAD.HACK),
		GetWeakThreads(growThreads * SEC_PER_THREAD.GROW),
		growThreads,
		hackThreads
	];
}
/** @param {import("../").NS} ns */
export function GetBatchRamL(ns, target, hackPct) {
	const threads = GetThreadsL(ns, target, hackPct);

	return (HACK_RAM * threads[IDS.H]) + (WEAKEN_GROW_RAM * (threads[IDS.W1] + threads[IDS.W2] + threads[IDS.G]));
}
/** @param {import("../").NS} ns */
export function GetBatchRam(ns, target, hackPct) {
	const threads = GetThreads(ns, target, hackPct);

	return (HACK_RAM * threads[IDS.H]) + (WEAKEN_GROW_RAM * (threads[IDS.W1] + threads[IDS.W2] + threads[IDS.G]));
}