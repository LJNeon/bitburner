import {TAIL_COLORS, DEFAULT_COLOR} from "utility/constants.js";
import {ScanAll} from "utility/generic.js";
import {GetHackPercent, BestXPServer} from "utility/metrics.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const targets = await FindBestServer(ns, 5);
	let message = `\n${TAIL_COLORS[3]}Best Server for XP: ${DEFAULT_COLOR}${BestXPServer(ns)}`;

	message += `\n${TAIL_COLORS[4]}Best Servers to Hack:`;

	if(targets.length === 0)
		return ns.tprint(`${message}\n${DEFAULT_COLOR}No hackable servers found.`);

	for(let i = 0; i < targets.length; i++) {
		message += `\n${TAIL_COLORS[4]}${i + 1}. ${DEFAULT_COLOR}${targets[i].target}`;
		message += ` (${targets[i].pct * 100}%) for ${ns.nFormat(targets[i].profit, "$0.00a")}/sec`;
	}

	ns.tprint(message);
}
/** @param {import("../").NS} ns */
export async function FindBestServer(ns, amount = 1) {
	const level = ns.getPlayer().skills.hacking;
	const servers = ScanAll(ns).filter(name => {
		const server = ns.getServer(name);

		return server.hasAdminRights && server.moneyMax > 0 && server.requiredHackingSkill <= level;
	});
	let results = [];

	for(const server of servers)
		results.push(await GetHackPercent(ns, server));

	results.sort((a, b) => b.profit - a.profit);
	results = results.filter(s => s.pct > 0);

	return amount === 1 ? results[0] : results.slice(0, amount);
}