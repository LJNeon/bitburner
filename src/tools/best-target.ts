import {NS} from "@ns";
import {Color} from "utility/enums";
import {GetMetrics, GetXPServer} from "utility/metrics";
import {nFormat, ScanAll} from "utility/misc";

interface Metrics {
	hostname: string;
	profit: number;
	leech: number;
	period: number;
	depth: number;
}

export async function main(ns: NS) {
	ns.disableLog("ALL");

	const targets = await FindBestServer(ns, 5);
	let message = `\n${Color.Success}Best Server for XP: ${Color.Default}${GetXPServer(ns).unwrapOr("N/A")}`;

	message += `\n${Color.Info}Best Servers to Hack:`;

	if(targets.length === 0)
		return ns.tprint(`${message}\n${Color.Default}No hackable servers found.`);

	for(let i = 0; i < targets.length; i++) {
		message += `\n${Color.Info}${i + 1}. ${Color.Default}${targets[i].hostname}`;
		message += ` at ${nFormat(targets[i].leech * 100, "l", 2)}% for $${nFormat(targets[i].profit)}/sec`;
	}

	ns.tprint(message);
}
export async function FindBestServer(ns: NS, amount = 1) {
	const servers = ScanAll(ns).filter(hostname => {
		const server = ns.getServer(hostname);

		return server.hasAdminRights && server.moneyMax > 0;
	});
	const results: Metrics[] = [];

	for(const hostname of servers) {
		GetMetrics(ns, hostname).match({
			Just: metrics => results.push({...metrics, hostname}),
			Nothing: () => {/*. to see here .*/}
		});
		await ns.sleep(0);
	}

	results.sort((a, b) => b.profit - a.profit);

	return results.slice(0, amount);
}