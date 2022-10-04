import {NS} from "@ns";
import {JOB_SPACER, HACK_LEVEL_RANGE} from "utility/constants";
import {Task} from "utility/enums";

/**
 * Calculates the period and depth for a range of hacking levels.
 * @param ns
 * @param target The target server to calculate for.
 * @param limit The maximum depth allowed by safety and available RAM.
 */
export function CalcPeriodDepth(ns: NS, target: string, limit: number) {
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
	let period;
	let depth;
	// Let the witchcraft begin!
	const kW_max = Math.min(Math.floor(1 + ((minWeakT - (4 * JOB_SPACER)) / (8 * JOB_SPACER))), limit);

	schedule: for(let kW = kW_max; kW >= 1; --kW) {
		const t_min_W = (maxWeakT + (4 * JOB_SPACER)) / kW;
		const t_max_W = (minWeakT - (4 * JOB_SPACER)) / (kW - 1);
		const kG_min = Math.ceil(Math.max((kW - 1) * 0.8, 1));
		const kG_max = Math.floor(1 + (kW * 0.8));

		for(let kG = kG_max; kG >= kG_min; --kG) {
			const t_min_G = (maxGrowT + (3 * JOB_SPACER)) / kG;
			const t_max_G = (minGrowT - (3 * JOB_SPACER)) / (kG - 1);
			const kH_min = Math.ceil(Math.max((kW - 1) * 0.25, (kG - 1) * 0.3125, 1));
			const kH_max = Math.floor(Math.min(1 + (kW * 0.25), 1 + (kG * 0.3125)));

			for(let kH = kH_max; kH >= kH_min; --kH) {
				const t_min_H = (maxHackT + (5 * JOB_SPACER)) / kH;
				const t_max_H = (minHackT - (1 * JOB_SPACER)) / (kH - 1);
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

	if(period == null || depth == null)
		return null;

	return {period, depth};
}
/**
 * Calculates the four HWGW delays for the current hacking level.
 */
export function CalcDelays(ns: NS, target: string, period: number, depth: number): Record<Task, number> {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;

	const weakT = ns.formulas.hacking.weakenTime(server, player);
	const growT = ns.formulas.hacking.growTime(server, player);
	const hackT = ns.formulas.hacking.hackTime(server, player);

	return {
		[Task.Weak1]: Math.round((period * depth) - (JOB_SPACER * 3) - weakT),
		[Task.Weak2]: Math.round((period * depth) - JOB_SPACER - weakT),
		[Task.Grow]: Math.round((period * depth) - (JOB_SPACER * 2) - growT),
		[Task.Hack]: Math.round((period * depth) - (JOB_SPACER * 4) - hackT)
	};
}