/** @param {import(".").NS} ns */
export async function main(ns) {
	const [target, id, port] = ns.args;

	await ns.hack(target);

	if(typeof port === "number")
		ns.writePort(port, id);
}