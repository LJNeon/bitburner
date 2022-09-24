import {
	HACK_RAM, WEAKEN_GROW_RAM, WEAKEN_GROW_EXTRA, IDS,
	SEC_PER_THREAD
} from "utility/constants.js";

/** @param {import("../").NS} ns */
export function GetWeakThreads(security) {
	return Math.ceil(security / SEC_PER_THREAD.WEAKEN * WEAKEN_GROW_EXTRA);
}

/** @param {import("../").NS} ns */
function CalcGrowth(ns, server, player, threads, cores) {
	const serverGrowth = ns.formulas.hacking.growPercent(server, threads, player, cores);

	return (server.moneyAvailable + threads) * serverGrowth;
}

/** @param {import("../").NS} ns */
function BinarySearchGrow(ns, min, max, server, player, cores) {
	if(min === max)
		return max;

	const threads = Math.ceil(min + ((max - min) / 2));
	const newMoney = CalcGrowth(ns, server, player, threads, cores);

	if(newMoney > server.moneyMax) {
		if(CalcGrowth(ns, server, player, threads - 1, cores) < server.moneyMax)
			return threads;

		return BinarySearchGrow(ns, min, threads - 1, server, player, cores);
	}else if(newMoney < server.moneyMax) {
		return BinarySearchGrow(ns, threads + 1, max, server, player, cores);
	}

	return threads;
}

/** @param {import("../").NS} ns */
export function GetGrowThreads(ns, server, player, cores = 1) {
	if(server.moneyAvailable >= server.moneyMax || isNaN(server.moneyAvailable))
		return 0;

	const max = Math.ceil(Math.log(server.moneyMax)
		/ Math.log(ns.formulas.hacking.growPercent(server, 1, player, cores)));
	const threads = Math.ceil(BinarySearchGrow(ns, 1, max, server, player, cores) * WEAKEN_GROW_EXTRA);
	const newMoney = CalcGrowth(ns, server, player, threads, cores);
	const diff = server.moneyMax - newMoney;

	if(diff > 0)
		ns.print(`Grow threads undershot by ${diff}.`);

	return threads;
}
/** @param {import("../").NS} ns */
export function GetHackThreads(ns, server, player, pct) {
	return Math.floor(pct / ns.formulas.hacking.hackPercent(server, player));
}
/** @param {import("../").NS} ns */
export function GetThreads(ns, target, pct) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;
	server.moneyAvailable = server.moneyMax;

	const hackThreads = GetHackThreads(ns, server, player, pct);

	server.moneyAvailable = server.moneyMax * (1 - pct);

	const growThreads = GetGrowThreads(ns, server, player);

	return [
		GetWeakThreads(hackThreads * SEC_PER_THREAD.HACK),
		GetWeakThreads(growThreads * SEC_PER_THREAD.GROW),
		growThreads,
		hackThreads
	];
}
/** @param {import("../").NS} ns */
export function GetBatchRam(ns, target, pct) {
	const threads = GetThreads(ns, target, pct);

	return (HACK_RAM * threads[IDS.H]) + (WEAKEN_GROW_RAM * (threads[IDS.W1] + threads[IDS.W2] + threads[IDS.G]));
}