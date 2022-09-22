import {
	WEAKEN_GROW_RAM, HACK_RAM, IDS, TIME_RATIOS,
	MONEY_PER_HACK, SAFETY_DELAY, RETRY_AFTER, TAIL_COLORS,
	DEFAULT_COLOR
} from "constants.js";
import {SleepPids} from "utility.js";
import RAM from "batcher/ram.js";
import RunScript from "batcher/run-script.js";
import {GetWeakThreads, GetGrowThreads, GetThreads} from "batcher/threads.js";

/** @param {import("../").NS} ns */
function EnoughRAM(ns, target, hackPct) {
	const ram = new RAM(ns);
	const threads = GetThreads(ns, target, hackPct);
	const weakRam = (threads[IDS.W1] + threads[IDS.W2]) * WEAKEN_GROW_RAM;
	const growRam = threads[IDS.G] * WEAKEN_GROW_RAM;
	const hackRam = threads[IDS.H] * HACK_RAM;
	const growMsg = `a server with ${ns.nFormat(growRam * 1e9, "0.00b")} RAM`;
	let result = ram.Smallest(growRam);

	if(result == null)
		return growMsg;
	else
		ram.Reserve(result.server, result.size);

	result = ram.Smallest(hackRam);

	if(result == null)
		return `${growMsg} and another with ${ns.nFormat(hackRam * 1e9, "0.00b")} RAM`;
	else
		ram.Reserve(result.server, result.size);

	if(ram.free - ram.reserved < weakRam)
		return `a total of ${ns.nFormat((weakRam + growRam + hackRam) * 1e9, "0.00b")} RAM`;
	else
		return "";
}

/** @param {import("../").NS} ns */
async function Prepare(ns, target) {
	let server;
	let already = true;

	while((server = ns.getServer(target)).hackDifficulty !== server.minDifficulty
			|| server.moneyAvailable !== server.moneyMax) {
		const {hackDifficulty, minDifficulty, moneyAvailable, moneyMax} = server;
		const pids = [];

		if(already) {
			already = false;
			ns.print(`${DEFAULT_COLOR}[-] Preparing server...`);
		}

		if(hackDifficulty !== minDifficulty) {
			const threads = GetWeakThreads(hackDifficulty - minDifficulty);

			ns.print(`${DEFAULT_COLOR}[!] Difficulty at ${hackDifficulty.toFixed(2)}/${minDifficulty.toFixed(2)}`);
			pids.push(...RunScript(ns, "weaken.js", target, threads, true, true));
		}

		if(hackDifficulty < 100 && moneyAvailable !== moneyMax) {
			const threads = GetGrowThreads(ns, server, ns.getPlayer());

			ns.print(`${DEFAULT_COLOR}[!] Cash at ${ns.nFormat(moneyAvailable, "$0.00a")}/${ns.nFormat(moneyMax, "$0.00a")}`);
			pids.push(...RunScript(ns, "grow.js", target, threads, false, true));
		}

		if(pids.length === 0)
			throw Error("Not enough RAM to spawn a single thread!");

		await SleepPids(ns, pids);
	}

	if(!already)
		ns.print(`${DEFAULT_COLOR}[-] Server prepared.`);
}

/** @param {import("../").NS} ns */
async function SleepLevelChange(ns, target, which, time) {
	const extra = time - (ns.getHackTime(target)
		* (which === IDS.W2 ? TIME_RATIOS.WEAKEN : which === IDS.G ? TIME_RATIOS.GROW : 1));

	await ns.asleep(extra);

	return extra;
}

function GetWhich(which, number = false) {
	if(number) {
		switch(which) {
			case IDS.H:
				return 0;
			case IDS.W1:
				return 1;
			case IDS.G:
				return 2;
			case IDS.W2:
				return 3;
		}
	}

	switch(which) {
		case IDS.W1:
		case IDS.W2:
			return "Weaken";
		case IDS.G:
			return "Grow";
		case IDS.H:
			return "Hack";
	}
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const [target, hackPct = MONEY_PER_HACK] = ns.args;

	try {
		ns.getServer(target);
	}catch{
		return ns.tprint(`${DEFAULT_COLOR}Server "${target}" doesn't exist.`);
	}

	if(hackPct <= 0 || hackPct > 1)
		return ns.tprint(`${DEFAULT_COLOR}The hack percent must be > 0 and <= 1.`);

	const enough = EnoughRAM(ns, target, hackPct);

	if(enough !== "")
		return ns.tprint(`${DEFAULT_COLOR}You need ${enough} to hack "${target}" at ${hackPct * 100}%.`);

	while(true) {
		await Prepare(ns, target);

		const hackT = ns.getHackTime(target);
		const weakT = hackT * TIME_RATIOS.WEAKEN;
		const growT = hackT * TIME_RATIOS.GROW;
		let extraT = 0;
		const level = ns.getPlayer().skills.hacking;
		const threads = GetThreads(ns, target, hackPct);
		const pids = {};
		let result = RunScript(ns, "weaken.js", target, threads[IDS.W1], true);

		if(result.length === 0) {
			ns.print(`${TAIL_COLORS[IDS.W1]}[!] Weaken x${threads[IDS.W1]} failed. Waiting ${RETRY_AFTER[1]}...`);
			await ns.asleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.W1] = result;
		}

		await ns.asleep(SAFETY_DELAY * 2);

		if(level !== ns.getPlayer().skills.hacking)
			extraT = await SleepLevelChange(ns, target, IDS.W2, weakT);

		result = RunScript(ns, "weaken.js", target, threads[IDS.W2], true);

		if(result.length === 0) {
			ns.print(`${TAIL_COLORS[IDS.W2]}[!] Weaken x${threads[IDS.W2]} failed. Waiting ${RETRY_AFTER[1]}...`);
			pids[IDS.W1].forEach(pid => ns.kill(pid));
			await ns.asleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.W2] = result;
		}

		await ns.asleep(weakT - growT - SAFETY_DELAY - extraT);

		if(level !== ns.getPlayer().skills.hacking)
			extraT = await SleepLevelChange(ns, target, IDS.G, growT);

		result = RunScript(ns, "grow.js", target, threads[IDS.G]);

		if(result.length === 0) {
			ns.print(`${TAIL_COLORS[IDS.G]}[!] Grow x${threads[IDS.G]} failed. Waiting ${RETRY_AFTER[1]}...`);
			Object.values(pids).flat().forEach(pid => ns.kill(pid));
			await ns.asleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.G] = result;
		}

		await ns.asleep(growT - hackT - (SAFETY_DELAY * 2) - extraT);

		if(level !== ns.getPlayer().skills.hacking)
			await SleepLevelChange(ns, target, IDS.H, hackT);

		result = RunScript(ns, "hack.js", target, threads[IDS.H]);

		if(result.length === 0) {
			ns.print(`${TAIL_COLORS[IDS.H]}[!] Hack x${threads[IDS.H]} failed. Waiting ${RETRY_AFTER[1]}...`);
			Object.values(pids).flat().forEach(pid => ns.kill(pid));
			await ns.asleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.H] = result;
		}

		for(let id = IDS.W1; id <= IDS.H; id++) {
			const num = GetWhich(id, true);

			SleepPids(ns, pids[id]).then(() => ns.print(`${TAIL_COLORS[num]}[${num + 1}] ${GetWhich(id)} ended.`));
		}

		await SleepPids(ns, Object.values(pids).flat());
		await ns.asleep(SAFETY_DELAY);
		ns.print(`${TAIL_COLORS[IDS.H + 1]}[-] Batch completed.`);
	}
}