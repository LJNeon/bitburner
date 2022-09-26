import {LEECH_PERCENTS} from "utility/constants.js";
import {ScanAll} from "utility/generic.js";
import {CalcPeriodDepth} from "utility/stalefish.js";
import {GetBatchRam} from "utility/threads.js";

/** @param {import("../").NS} ns */
export async function GetHackPercent(ns, target) {
	const free = ScanAll(ns)
		.map(n => ns.getServer(n))
		.filter(s => s.hasAdminRights)
		.reduce((n, s) => n + s.maxRam - s.ramUsed, 0);
	let pct = 0;
	let profit = 0;
	let period;
	let depth;

	for(const hackPct of LEECH_PERCENTS) {
		const batchSize = GetBatchRam(ns, target, hackPct);
		const sizeLimit = Math.floor(free / batchSize);

		if(sizeLimit === 0)
			break;

		const server = ns.getServer(target);

		server.hackDifficulty = server.minDifficulty;

		const chance = ns.formulas.hacking.hackChance(server, ns.getPlayer());
		const sf = CalcPeriodDepth(ns, target, sizeLimit);

		if(sf == null)
			break;

		const nextProfit = server.moneyMax * hackPct * chance * sf.depth / (sf.period * sf.depth / 1e3);

		if(nextProfit > profit) {
			pct = hackPct;
			profit = nextProfit;
			period = sf.period;
			depth = sf.depth;
		}else{
			break;
		}

		await ns.sleep(5);
	}

	return {
		target,
		pct,
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