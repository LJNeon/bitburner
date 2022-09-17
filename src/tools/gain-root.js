import {ScanAll} from "utility.js";

const portOpeners = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];

/** @param {import("../").NS} ns */
export function OpenablePorts(ns) {
	return portOpeners.filter(file => ns.fileExists(file)).length;
}
/** @param {import("../").NS} ns */
export async function main(ns) {
	const openable = OpenablePorts(ns);
	const targets = ScanAll(ns).filter(s => !ns.hasRootAccess(s) && ns.getServerNumPortsRequired(s) <= openable);

	for(const target of targets) {
		try {
			ns.brutessh(target);
			ns.ftpcrack(target);
			ns.relaysmtp(target);
			ns.httpworm(target);
			ns.sqlinject(target);
		}catch{}

		try {
			ns.nuke(target);
		}catch{}

		if(ns.getServerMaxRam(target) > 0)
			await ns.scp(["weaken.js", "grow.js", "hack.js"], target);
	}

	ns.tprint(`Gained root access to ${targets.length} server${targets.length === 1 ? "" : "s"}.`);
}