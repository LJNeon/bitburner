import {SAFETY_DELAY, HACK_LEVEL_RANGE} from "constants.js";
import {GetBatchRam} from "utility.js";
import {RAM} from "batcher/ram.js";

/** @param {import("../").NS} ns */
export function CalcPeriodDepth(ns, target, hackPct) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;

	const maxWeakT = ns.formulas.hacking.weakenTime(server, player);
	const maxGrowT = ns.formulas.hacking.growTime(server, player);
	const maxHackT = ns.formulas.hacking.hackTime(server, player);

	player.skills.hacking += HACK_LEVEL_RANGE;

	const minWeakT = ns.formulas.hacking.weakenTime(server, player);
	const minGrowT = ns.formulas.hacking.growTime(server, player);
	const minHackT = ns.formulas.hacking.hackTime(server, player);
	const ram = new RAM(ns, true);
	const batchRam = GetBatchRam(ns, target, hackPct);
	const maxDepthByRam = Math.floor(ram.total / batchRam);
	const maxDepthByDesync = Math.floor(minWeakT / (SAFETY_DELAY * 4) / 2);
	let period;
	let depth;
	// Let the witchcraft begin!
	const kW_max = Math.min(
		Math.floor(1 + ((minWeakT - (4 * SAFETY_DELAY)) / (8 * SAFETY_DELAY))),
		maxDepthByRam,
		maxDepthByDesync
	);

	schedule: for(let kW = kW_max; kW >= 1; --kW) {
		const t_min_W = (maxWeakT + (4 * SAFETY_DELAY)) / kW;
		const t_max_W = (minWeakT - (4 * SAFETY_DELAY)) / (kW - 1);
		const kG_min = Math.ceil(Math.max((kW - 1) * 0.8, 1));
		const kG_max = Math.floor(1 + (kW * 0.8));

		for(let kG = kG_max; kG >= kG_min; --kG) {
			const t_min_G = (maxGrowT + (3 * SAFETY_DELAY)) / kG;
			const t_max_G = (minGrowT - (3 * SAFETY_DELAY)) / (kG - 1);
			const kH_min = Math.ceil(Math.max((kW - 1) * 0.25, (kG - 1) * 0.3125, 1));
			const kH_max = Math.floor(Math.min(1 + (kW * 0.25), 1 + (kG * 0.3125)));

			for(let kH = kH_max; kH >= kH_min; --kH) {
				const t_min_H = (maxHackT + (5 * SAFETY_DELAY)) / kH;
				const t_max_H = (minHackT - (1 * SAFETY_DELAY)) / (kH - 1);
				const t_min = Math.max(t_min_H, t_min_G, t_min_W);
				const t_max = Math.min(t_max_H, t_max_G, t_max_W);

				if(t_min <= t_max) {
					period = Math.round(t_min);
					depth = Math.floor(kW);

					break schedule;
				}
			}
		}
	}

	return {period, depth};
}
/** @param {import("../").NS} ns */
export function CalcDelays(ns, target, period, depth) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;

	const weakT = ns.formulas.hacking.weakenTime(server, player);
	const growT = ns.formulas.hacking.growTime(server, player);
	const hackT = ns.formulas.hacking.hackTime(server, player);

	return {
		H: Math.round((depth * period) - (SAFETY_DELAY * 4) - hackT),
		W1: Math.round((depth * period) - (SAFETY_DELAY * 3) - weakT),
		G: Math.round((depth * period) - (SAFETY_DELAY * 2) - growT),
		W2: Math.round((depth * period) - SAFETY_DELAY - weakT)
	};
}
/** @param {import("../").NS} ns */
export function CalcDelayS(ns, target, period, depth) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;

	const weakT = ns.formulas.hacking.weakenTime(server, player);
	const growT = ns.formulas.hacking.growTime(server, player);
	const hackT = ns.formulas.hacking.hackTime(server, player);

	return [
		Math.round((depth * period) - (SAFETY_DELAY * 3) - weakT),
		Math.round((depth * period) - SAFETY_DELAY - weakT),
		Math.round((depth * period) - (SAFETY_DELAY * 2) - growT),
		Math.round((depth * period) - (SAFETY_DELAY * 4) - hackT)
	];
}