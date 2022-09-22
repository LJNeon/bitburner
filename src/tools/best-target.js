import {TAIL_COLORS, DEFAULT_COLOR} from "constants.js";
import {ScanAll} from "utility.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const targets = FindBestServer(ns, 10);

	if(targets.length === 0)
		return ns.tprint(`${DEFAULT_COLOR}Oops! No valid servers to hack found.`);

	let message = `${TAIL_COLORS[4]}Best Servers to Hack:`;

	for(let i = 0; i < targets.length; i++)
		message += `\n${TAIL_COLORS[4]}${i + 1}. ${DEFAULT_COLOR}${targets[i]}`;

	ns.tprint(message);
}

/** @param {import("../").NS} ns */
function ScoreServer(ns, server) {
	return ns.getServerMaxMoney(server) / ns.getServerMinSecurityLevel(server) / ns.getWeakenTime(server);
}

/** @param {import("../").NS} ns */
export function FindBestServer(ns, amount = 1) {
	const servers = ScanAll(ns).filter(s => ns.hasRootAccess(s) && ns.getServerMaxMoney(s) > 0
		&& ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel() / 2);

	servers.sort((a, b) => ScoreServer(ns, b) - ScoreServer(ns, a));

	return amount === 1 ? servers[0] : servers.slice(0, amount);
}