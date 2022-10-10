import {NS} from "@ns";
import {NORM_ABBRS, BYTE_ABBRS} from "utility/constants";
import {Color} from "utility/enums";

let lastID = 0;

export function GenID() {
	return lastID = (lastID + 1) % Number.MAX_SAFE_INTEGER;
}
export function Impossible(): never {
	throw Error("TS caught something?!?!");
}
export function ScanAll(ns: NS, root = "home", found = new Set<string>()) {
	found.add(root);

	for(const server of ns.scan(root)) {
		if(!found.has(server))
			ScanAll(ns, server, found);
	}

	return Array.from(found.values());
}
export function CheckPids(ns: NS, pids: number[]) {
	return pids.every(pid => ns.getRunningScript(pid) == null);
}
export async function SleepPids(ns: NS, pids: number[]) {
	while(!CheckPids(ns, pids))
		await ns.asleep(5);
}

function Floor(num: number) {
	return num > 0 ? Math.floor(num) : Math.ceil(num);
}

/*.
 * "l" is long format, e.g. 1,234,567
 * "n" is normal format, e.g. 1.23m
 * "b" is byte format, e.g. 1.23GB
.*/
export function nFormat(num: number, format = "n", dec = 0) {
	const abbrs = format === "b" ? BYTE_ABBRS : NORM_ABBRS;
	const roundAt = Math.pow(10, dec);

	if(num < 1e3 && num > -1e3) {
		return `${Floor(num * roundAt) / roundAt}${abbrs[0]}`;
	}else if(format === "l") {
		let result = String(Floor(num * roundAt) / roundAt);
		const end = dec === 0 ? result.length : result.lastIndexOf(".");

		for(let i = end - 3; i > 0; i -= 3)
			result = `${result.slice(0, i)},${result.slice(i)}`;

		return result;
	}

	let size = Floor(Math.log(Math.abs(num)) / Math.log(10));

	if(size < 0)
		size = 0;

	const places = size % 3 === 0 ? 2 : (size - 1) % 3 === 0 ? 1 : 0;
	const which = Floor(size / 3);

	if(which >= abbrs.length)
		return "infinite";

	return `${Floor(num / Math.pow(10, (which * 3) - places)) / Math.pow(10, places)}${abbrs[which]}`;
}
export function Table(title: string, rows: Map<string, string>, color: Color) {
	const keySize = Array.from(rows.keys()).map(k => k.length).sort((a, b) => b - a)[0];
	const valueSize = Array.from(rows.values()).map(v => v.length).sort((a, b) => b - a)[0];
	const width = keySize + valueSize + 5;
	const padding = (width - title.length) / 2;
	const left = Math.floor(padding);
	const right = Math.ceil(padding);
	const c = color;
	const r = Color.Default;
	let result =  `${c}┌${"─".repeat(width)}┐\n|${" ".repeat(left)}${r}${title}${c}${" ".repeat(right)}|`;

	result += `\n├${"─".repeat(keySize + 2)}┬${"─".repeat(valueSize + 2)}┤\n`;
	result += Array.from(rows.entries())
		.map(([k, v]) => `| ${r}${k.padEnd(keySize, " ")}${c} | ${r}${v.padEnd(valueSize, " ")}${c} |`)
		.join("\n");
	result += `└${"─".repeat(keySize + 2)}┴${"─".repeat(valueSize + 2)}┘`;

	return result;
}
export function ClearLastLogs(ns: NS, amount: number, match?: string) {
	const lines = ns.getScriptLogs();

	ns.clearLog();

	if(lines.length === 0 || amount >= lines.length)
		return;

	for(let i = 0; i < lines.length; i++) {
		if(lines.length - amount > i || (match != null && !lines[i].includes(match)))
			ns.print(lines[i]);
	}
}
export function ReadPortIDs(ns: NS, port: number) {
	const handle = ns.getPortHandle(port);
	const results = [];

	while(!handle.empty()) {
		const id = handle.read();

		if(typeof id === "number")
			results.push(id);
	}

	return results;
}