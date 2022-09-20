/** @param {import(".").NS} ns */
export function GenID(existing = []) {
	let id = Math.random().toString(16).slice(-6);

	while(existing.includes(id))
		id = Math.random().toString(16).slice(-6);

	return id;
}
/** @param {import(".").NS} ns */
export function ScanAll(ns, root = "home", found = new Set()) {
	found.add(root);

	for(const server of ns.scan(root)) {
		if(!found.has(server))
			ScanAll(ns, server, found);
	}

	return Array.from(found.values());
}
/** @param {import(".").NS} ns */
export function CheckPids(ns, pids) {
	return pids.every(pid => ns.getRunningScript(pid) == null);
}
/** @param {import(".").NS} ns */
export async function SleepPids(ns, pids) {
	while(!CheckPids(ns, pids))
		await ns.asleep(5);
}