import {
	IDS, JOB_SPACER, HACK_LEVEL_RANGE, SEC_PER_THREAD,
	LEECH_PERCENTS
} from "utility/constants.js";
import {ScanAll} from "utility/misc.js";
import RAM from "utility/ram.js";
import {FindScriptRAM} from "utility/run-script.js";
import {CalcPeriodDepth} from "utility/stalefish.js";

/** @param {import("../").NS} ns */
export function GetWeakThreads(security) {
	return Math.ceil(security / SEC_PER_THREAD.WEAKEN);
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
	const threads = BinarySearchGrow(ns, 1, max, server, player, cores);
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
export function GetThreads(ns, server, player, pct) {
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
function DepthByRAM(ns, target, pct) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;
	player.skills.hacking += HACK_LEVEL_RANGE;

	const weakT = ns.formulas.hacking.weakenTime(server, player);
	const limit = Math.floor(weakT / (JOB_SPACER * 8));
	const ram = new RAM(ns, true);
	const threads = GetThreads(ns, server, player, pct);
	let depth = 0;

	for(; depth < limit; depth++) {
		if(FindScriptRAM(ns, ram, "weaken.js", threads[IDS.W1], true).length === 0)
			break;
		else if(FindScriptRAM(ns, ram, "weaken.js", threads[IDS.W2], true).length === 0)
			break;
		else if(FindScriptRAM(ns, ram, "grow.js", threads[IDS.G], true).length === 0)
			break;
		else if(FindScriptRAM(ns, ram, "hack.js", threads[IDS.H], true).length === 0)
			break;
	}

	return depth;
}

/** @param {import("../").NS} ns */
export async function GetMetrics(ns, target) {
	let percent = 0;
	let profit = 0;
	let period;
	let depth;

	for(const hackPct of LEECH_PERCENTS) {
		const limit = DepthByRAM(ns, target, hackPct);

		if(limit === 0)
			break;

		const server = ns.getServer(target);

		server.hackDifficulty = server.minDifficulty;

		const chance = ns.formulas.hacking.hackChance(server, ns.getPlayer());
		const sf = CalcPeriodDepth(ns, target, limit);

		if(sf == null)
			break;

		const nextProfit = server.moneyMax * chance * hackPct * sf.depth / (sf.period * sf.depth / 1e3);

		if(nextProfit > profit) {
			percent = hackPct;
			profit = nextProfit;
			({period, depth} = sf);
		}

		await ns.sleep(5);
	}

	return {
		target,
		percent,
		profit,
		period,
		depth
	};
}
/** @param {import("../").NS} ns */
export function BestXPServer(ns) {
	const servers = ScanAll(ns).map(n => ns.getServer(n));
	const player = ns.getPlayer();
	let best;
	let score;

	for(const server of servers) {
		server.hackDifficulty = server.minDifficulty;

		const nextScore = ns.formulas.hacking.hackExp(server, player) / ns.formulas.hacking.growTime(server, player);

		if(score == null || nextScore > score) {
			best = server.hostname;
			score = nextScore;
		}
	}

	return best;
}