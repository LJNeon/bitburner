import {NS} from "@ns";
import {TASK_SCRIPTS, PERSONAL_SERVER_SHARE} from "utility/constants.js";
import {GenID, ScanAll} from "utility/misc.js";

const MONEY_LIMIT = 0.4;

function GrabID(hostname: string) {
	return Number(hostname.slice(hostname.lastIndexOf("-") + 1));
}

function GetTotalRam(ns: NS) {
	return ScanAll(ns).reduce((a, b) => a + ns.getServerMaxRam(b), 0);
}

async function BuyServer(ns: NS, id: number, ram: number, upgraded = false) {
	const displayRam = ns.nFormat(ram * 1e9, "0.00b");
	const server = `server-${displayRam}-${id}`;
	const shareRam = ns.getScriptRam("share.js");

	ns.purchaseServer(server, ram);
	await ns.scp(["share.js", ...TASK_SCRIPTS], server);
	ns.exec("share.js", server, Math.floor(ram / shareRam * PERSONAL_SERVER_SHARE));
	ns.print(`${upgraded ? "Upgraded" : "Purchased"} server ${id} with ${displayRam} RAM.`);
}

export async function main(ns: NS) {
	ns.disableLog("ALL");

	while(true) {
		const servers = ns.getPurchasedServers();
		const money = ns.getServerMoneyAvailable("home") * MONEY_LIMIT;
		const maxSize = Math.log2(ns.getPurchasedServerMaxRam());

		if(servers.length < ns.getPurchasedServerLimit()) {
			for(let i = maxSize; i >= 1; i--) {
				const ram = 2 ** i;
				const cost = ns.getPurchasedServerCost(ram);

				if(cost <= money && (ram / GetTotalRam(ns) >= 0.24 || i === maxSize)) {
					await BuyServer(ns, GenID(), ram);

					break;
				}
			}
		}else{
			servers.sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b));

			const smallest = servers.shift();

			if(smallest == null || ns.getServerMaxRam(smallest) === maxSize)
				break;

			for(let i = maxSize; i >= 1; i--) {
				const ram = 2 ** i;
				const cost = ns.getPurchasedServerCost(ram);

				if(cost <= money && (ram / GetTotalRam(ns) >= 0.24 || i === maxSize) && ram > ns.getServerMaxRam(smallest)) {
					ns.killall(smallest);
					ns.deleteServer(smallest);
					await BuyServer(ns, GrabID(smallest), ram, true);

					break;
				}
			}
		}

		await ns.sleep(1e3);
	}
}