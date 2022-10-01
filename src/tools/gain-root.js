import {TASK_SCRIPTS, PORT_PROGRAMS, DEFAULT_COLOR} from "utility/constants.js";
import {ScanAll} from "utility/misc.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	const programs = PORT_PROGRAMS.map(file => ns.fileExists(file));
	const openable = programs.filter(p => p).length;
	const targets = ScanAll(ns).filter(s => !ns.hasRootAccess(s) && ns.getServerNumPortsRequired(s) <= openable);

	for(const target of targets) {
		if(programs[0])
			ns.brutessh(target);

		if(programs[1])
			ns.ftpcrack(target);

		if(programs[2])
			ns.relaysmtp(target);

		if(programs[3])
			ns.httpworm(target);

		if(programs[4])
			ns.sqlinject(target);

		ns.nuke(target);

		if(ns.getServerMaxRam(target) > 0)
			await ns.scp(TASK_SCRIPTS, target);
	}

	ns.tprint(`${DEFAULT_COLOR}Gained root access to ${targets.length} server${targets.length === 1 ? "" : "s"}.`);
}