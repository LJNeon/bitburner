import {TAIL_COLORS, DEFAULT_COLOR} from "constants.js";
import {ScanAll} from "utility.js";
import {GetHackPercent} from "batcher/metrics.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const targets = await FindBestServer(ns, 10);

	if(targets.length === 0)
		return ns.tprint(`${DEFAULT_COLOR}Oops! No valid servers to hack found.`);

	let message = `${TAIL_COLORS[4]}Best Servers to Hack:`;

	for(let i = 0; i < targets.length; i++) {
		message += `\n${TAIL_COLORS[4]}${i + 1}. ${DEFAULT_COLOR}${targets[i].target}`;
		message += ` (${targets[i].pct * 100}%) for ${ns.nFormat(targets[i].profit, "$0.00a")}/sec`;
	}

	ns.tprint(message);
}
/** @param {import("../").NS} ns */
export async function FindBestServer(ns, amount = 1) {
	const servers = ScanAll(ns).filter(s => ns.hasRootAccess(s) && ns.getServerMaxMoney(s) > 0);
	const results = [];

	for(const server of servers)
		results.push(await GetHackPercent(ns, server));

	results.sort((a, b) => b.profit - a.profit);

	return amount === 1 ? results[0] : results.slice(0, amount);
}