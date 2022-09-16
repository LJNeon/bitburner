import {PERSONAL_SERVER_SHARE} from "constants.js";
import {GenID, ScanAll} from "utility.js";

const MONEY_LIMIT = 0.4;
const MAX_RAM = 2 ** 20;

/** @param {import("../").NS} ns */
function GetTotalRam(ns) {
	return ScanAll(ns).reduce((a, b) => a + ns.getServerMaxRam(b), 0);
}

/** @param {import("../").NS} ns */
async function BuyServer(ns, id, ram, upgraded = false) {
	const displayRam = ns.nFormat(ram * 1e9, "0.00b");
	const name = `server-${displayRam}-${id}`;
	const shareRam = ns.getScriptRam("share.js");

	ns.purchaseServer(name, ram);
	await ns.scp(["weaken.js", "grow.js", "hack.js", "share.js"], name);
	ns.exec("share.js", name, Math.floor(ram / shareRam * PERSONAL_SERVER_SHARE));
	ns.print(`${upgraded ? "Upgraded" : "Purchased"} server ${id} with ${displayRam} RAM.`);
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	while(true) {
		const servers = ns.getPurchasedServers();
		const money = ns.getServerMoneyAvailable("home") * MONEY_LIMIT;

		if(servers.length < ns.getPurchasedServerLimit()) {
			for(let i = 20; i >= 1; i--) {
				const ram = 2 ** i;
				const cost = ns.getPurchasedServerCost(ram);

				if(cost <= money && (ram / GetTotalRam(ns) >= 0.24 || i === 20)) {
					await BuyServer(ns, GenID(ns), ram);

					break;
				}
			}
		}else{
			servers.sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b));

			const smallest = servers.shift();

			if(ns.getServerMaxRam(smallest) === MAX_RAM)
				break;

			for(let i = 20; i >= 1; i--) {
				const ram = 2 ** i;
				const cost = ns.getPurchasedServerCost(ram);

				if(cost <= money && (ram / GetTotalRam(ns) >= 0.24 || i === 20) && ram > ns.getServerMaxRam(smallest)) {
					ns.killall(smallest);
					ns.deleteServer(smallest);
					await BuyServer(ns, smallest.slice(smallest.lastIndexOf("-") + 1), ram, true);

					break;
				}
			}
		}

		await ns.sleep(1e4);
	}
}