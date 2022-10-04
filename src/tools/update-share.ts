import {NS} from "@ns";
import {PERSONAL_SERVER_SHARE} from "utility/constants.js";

export async function main(ns: NS) {
	const script = "share.js";
	const ratio = Number(ns.args[0] ?? PERSONAL_SERVER_SHARE);
	const shareRam = ns.getScriptRam(script);

	for(const server of ns.getPurchasedServers()) {
		if(ns.scriptRunning(script, server) != null)
			ns.scriptKill(script, server);

		ns.exec(script, server, Math.floor(ns.getServerMaxRam(server) / shareRam * ratio));
	}
}