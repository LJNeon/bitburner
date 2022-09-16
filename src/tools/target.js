import {ScanAll} from "utility.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const targets = FindBestServer(ns, 15);

	if(targets.length === 0)
		return ns.tprint("Oops! No valid servers to hack found.");

	let message = "Best Servers to Hack:";

	for(let i = 0; i < targets.length; i++)
		message += `\n${i + 1}. ${targets[i]}`;

	ns.tprint(message);
}

/** @param {import("../").NS} ns */
function ScoreServer(ns, server) {
	return ns.getServerMaxMoney(server) / ns.getServerMinSecurityLevel(server);
}

/** @param {import("../").NS} ns */
export function FindBestServer(ns, amount = 1) {
	const servers = ScanAll(ns).filter(s => ns.hasRootAccess(s) && ns.getServerMaxMoney(s) > 0
		&& ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel() / 2);

	servers.sort((a, b) => ScoreServer(ns, b) - ScoreServer(ns, a));

	return amount === 1 ? servers[0] : servers.slice(0, amount);
}