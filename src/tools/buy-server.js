import {TASK_SCRIPTS, PERSONAL_SERVER_SHARE} from "utility/constants.js";
import {GenID, ScanAll} from "utility/generic.js";

const MONEY_LIMIT = 0.4;
const MAX_RAM = 2 ** 20;

function GrabID(name) {
	return name.slice(name.lastIndexOf("-") + 1);
}

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
	await ns.scp(["share.js", ...TASK_SCRIPTS], name);
	ns.exec("share.js", name, Math.floor(ram / shareRam * PERSONAL_SERVER_SHARE));
	ns.print(`${upgraded ? "Upgraded" : "Purchased"} server ${id} with ${displayRam} RAM.`);
}

/** @param {import("../").NS} ns */
export async function main(ns) {
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
					await BuyServer(ns, GenID(servers.map(s => GrabID(s))), ram);

					break;
				}
			}
		}else{
			servers.sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b));

			const smallest = servers.shift();

			if(ns.getServerMaxRam(smallest) === MAX_RAM)
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