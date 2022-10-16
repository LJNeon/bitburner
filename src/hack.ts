import {NS} from "@ns";

export async function main(ns: NS) {
	const [target, id, port] = ns.args;

	if(typeof target !== "string")
		return ns.print("Invalid target!");

	await ns.hack(target);

	if(typeof id !== "boolean" && typeof port === "number")
		await ns.writePort(port, id);
}