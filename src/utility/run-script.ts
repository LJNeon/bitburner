import {NS} from "@ns";
import {SCRIPTS_BY_TASK} from "utility/constants";
import {Task} from "utility/enums";
import RAM from "utility/ram";

export function RunScript(
	ns: NS, task: Task, threads: number,
	spread = false, partial = false,
	...args: (string | number | boolean)[]
) {
	const ram = new RAM(ns);
	const pids = [];
	let hosts;

	if(spread)
		hosts = ram.ReserveAll(task, threads, partial).unwrapOr([]);
	else
		hosts = ram.Reserve(task, threads, partial).map(server => [server]).unwrapOr([]);

	for(const server of hosts) {
		const pid = ns.exec(SCRIPTS_BY_TASK[task], server.hostname, server.threads, ...args);

		if(pid === 0) {
			pids.forEach(id => ns.kill(id));

			throw Error("Failed to execute script!");
		}

		pids.push(pid);
	}

	return pids;
}