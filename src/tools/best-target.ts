import {NS} from "@ns";
import {Color} from "utility/enums";
import {GetMetrics, BestXPServer, Metrics} from "utility/metrics";
import {ScanAll} from "utility/misc";

export async function main(ns: NS) {
	ns.disableLog("ALL");

	const targets = await FindBestServer(ns, 5);
	let message = `\n${Color.Success}Best Server for XP: ${Color.Default}${BestXPServer(ns)}`;

	message += `\n${Color.Info}Best Servers to Hack:`;

	if(targets.length === 0)
		return ns.tprint(`${message}\n${Color.Default}No hackable servers found.`);

	for(let i = 0; i < targets.length; i++) {
		message += `\n${Color.Info}${i + 1}. ${Color.Default}${targets[i].hostname}`;
		message += ` (${targets[i].percent * 100}%) for ${ns.nFormat(targets[i].profit, "$0.00a")}/sec`;
	}

	ns.tprint(message);
}
export async function FindBestServer(ns: NS, amount = 1) {
	const servers = ScanAll(ns).filter(hostname => {
		const server = ns.getServer(hostname);

		return server.hasAdminRights && server.moneyMax > 0;
	});
	let results: Metrics[] = [];

	for(const hostname of servers) {
		const metrics = await GetMetrics(ns, hostname);

		if(metrics != null)
			results.push(metrics);
	}

	results.sort((a, b) => b.profit - a.profit);
	results = results.filter(s => s.percent > 0);

	return results.slice(0, amount);
}