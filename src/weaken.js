/** @param {import(".").NS} ns */
export async function main(ns) {
	const [target, id, port] = ns.args;

	await ns.weaken(target);

	if(port != null)
		ns.writePort(port, id);
}