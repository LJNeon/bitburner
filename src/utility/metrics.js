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
		const {period: p, depth: d} = CalcPeriodDepth(ns, target, sizeLimit);
		const nextProfit = Math.floor(server.moneyMax * hackPct) * d / (p * d / 1e3);

		if(nextProfit > profit) {
			pct = hackPct;
			profit = nextProfit;
			period = p;
			depth = d;
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