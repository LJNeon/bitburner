import {PERSONAL_SERVER_SHARE} from "constants.js";

/** @param {import("../").NS} ns */
export async function main(ns) {
	const shareRam = ns.getScriptRam("share.js");

	for(const server of ns.getPurchasedServers())
		ns.exec("share.js", server, Math.floor(ns.getServerMaxRam(server) / shareRam * PERSONAL_SERVER_SHARE));
}