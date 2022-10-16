import {NS} from "@ns";
import {TASK_SCRIPTS, PORT_PROGRAMS} from "utility/constants";
import {Color} from "utility/enums";
import {ScanAll} from "utility/misc";

export function main(ns: NS) {
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

		if(ns.getServerMaxRam(target) !== 0)
			ns.scp(TASK_SCRIPTS, target);
	}

	ns.tprint(`${Color.Default}Gained root access to ${targets.length} server${targets.length === 1 ? "" : "s"}.`);
}