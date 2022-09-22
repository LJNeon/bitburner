import {
	HACK_RAM, WEAKEN_GROW_RAM, WEAKEN_GROW_EXTRA, IDS,
	SEC_PER_THREAD
} from "utility/constants.js";

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
export function GetThreads(ns, target, hackPct) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;
	server.moneyAvailable = server.moneyMax;

	const hackThreads = GetHackThreads(ns, server, player, hackPct);

	server.moneyAvailable = server.moneyMax * (1 - hackPct);

	const growThreads = GetGrowThreads(ns, server, player);

	return [
		GetWeakThreads(hackThreads * SEC_PER_THREAD.HACK),
		GetWeakThreads(growThreads * SEC_PER_THREAD.GROW),
		growThreads,
		hackThreads
	];
}
/** @param {import("../").NS} ns */
export function GetBatchRam(ns, target, hackPct) {
	const threads = GetThreads(ns, target, hackPct);

	return (HACK_RAM * threads[IDS.H]) + (WEAKEN_GROW_RAM * (threads[IDS.W1] + threads[IDS.W2] + threads[IDS.G]));
}