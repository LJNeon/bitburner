import {DEFAULT_COLOR, NORM_ABBRS, BYTE_ABBRS} from "utility/constants.js";

/** @param {import("../").NS} ns */
export function GenID(existing = []) {
	let id = Math.random().toString(16).slice(-6);

	while(existing.includes(id))
		id = Math.random().toString(16).slice(-6);

	return id;
}
/** @param {import("../").NS} ns */
export function ScanAll(ns, root = "home", found = new Set()) {
	found.add(root);

	for(const server of ns.scan(root)) {
		if(!found.has(server))
			ScanAll(ns, server, found);
	}

	return Array.from(found.values());
}
/** @param {import("../").NS} ns */
export function CheckPids(ns, pids) {
	return pids.every(pid => ns.getRunningScript(pid) == null);
}
/** @param {import("../").NS} ns */
export async function SleepPids(ns, pids) {
	while(!CheckPids(ns, pids))
		await ns.asleep(5);
}
export function LongFormat(num) {
	let result = String(Math.floor(num));

	for(let i = result.length - 3; i > 0; i -= 3)
		result = `${result.slice(0, i)},${result.slice(i)}`;

	return result;
}

function Floor(num) {
	return num > 0 ? Math.floor(num) : Math.ceil(num);
}

/*.
 * "l" is long format, e.g. 1,234,567
 * "n" is normal format, e.g. 1.23M
 * "b" is byte format, e.g. 1.23GB
.*/
export function nFormat(num, format = "n", dec = 0) {
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
export function Table(rows, color) {
	const longestKey = Object.keys(rows).map(k => k.length).sort((a, b) => b - a)[0];
	const longestValue = Object.values(rows).map(v => v.length).sort((a, b) => b - a)[0];
	const separator = `${color}|${DEFAULT_COLOR}`;
	let result = "";

	for(const row in rows) {
		const key = row.length < longestKey ? row.padEnd(longestKey) : row;
		const value = rows[row].length < longestValue ? rows[row].padEnd(longestValue) : rows[row];

		result += `\n ${separator} ${key} ${separator} ${value} ${separator}`;
	}

	return result;
}