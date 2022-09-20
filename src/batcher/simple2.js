import {
	IDS, TIME_RATIOS, MONEY_PER_HACK, SAFETY_DELAY,
	RETRY_AFTER, CONSOLE_COLORS, DEFAULT_COLOR
} from "constants.js";
import {
	SleepPids, GetWeakThreads, CalcGrowThreadsL, GetThreadsL, GetBatchRamL
} from "utility.js";
import RAM from "batcher/ram.js";
import RunScript from "batcher/run-script.js";

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
			ns.print(`${DEFAULT_COLOR}[!] Difficulty at ${hackDifficulty.toFixed(2)}/${minDifficulty.toFixed(2)}`);
			pids.push(RunScript(ns, "weaken.js", target, GetWeakThreads(ns, target), true));
		}else if(moneyAvailable !== moneyMax) {
			ns.print(`${DEFAULT_COLOR}[!] Cash at ${ns.nFormat(moneyAvailable, "$0.00a")}/${ns.nFormat(moneyMax, "$0.00a")}`);
			pids.push(RunScript(ns, "grow.js", target, CalcGrowThreadsL(ns, target, moneyMax - moneyAvailable), true));
		}

		await SleepPids(ns, pids);
	}

	if(!already)
		ns.print(`${DEFAULT_COLOR}[-] Server prepared.`);
}

/** @param {import("../").NS} ns */
async function SleepLevelChange(ns, target, which, time) {
	const extra = time - (ns.getHackTime(target)
		* (which === IDS.W2 ? TIME_RATIOS.WEAKEN : which === IDS.G ? TIME_RATIOS.GROW : 1));

	await ns.sleep(extra);

	return extra;
}

function GetName(which) {
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
		return ns.tprint(`Server "${target}" doesn't exist.`);
	}

	if(hackPct <= 0 || hackPct > 1)
		return ns.tprint("The hack percent must be > 0 and <= 1.");

	const ram = new RAM();
	const required = GetBatchRamL(ns, target, hackPct);

	if(required >= ram.free)
		return ns.tprint(`Hacking "${target}" at ${hackPct * 100}% requires ${ns.nFormat(required, "0.00b")} of free RAM.`);

	while(true) {
		await Prepare(ns, target);

		const hackT = ns.getHackTime(target);
		const weakT = hackT * TIME_RATIOS.WEAKEN;
		const growT = hackT * TIME_RATIOS.GROW;
		let extraT = 0;
		const level = ns.getPlayer().skills.hacking;
		const threads = GetThreadsL(ns, target, hackPct);
		const pids = {};
		let result = RunScript(ns, "weaken.js", target, threads[IDS.W1]);

		if(result.length === 0) {
			ns.print(`${CONSOLE_COLORS[IDS.W1]}[!] Weaken x${threads[IDS.W1]} failed. Waiting ${RETRY_AFTER[1]}...`);
			await ns.sleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.W1] = result;
		}

		await ns.sleep(SAFETY_DELAY * 2);

		if(level !== ns.getPlayer().skills.hacking)
			extraT += await SleepLevelChange(ns, target, IDS.W2, weakT);

		result = RunScript(ns, "weaken.js", target, threads[IDS.W2]);

		if(result.length === 0) {
			ns.print(`${CONSOLE_COLORS[IDS.W2]}[!] Weaken x${threads[IDS.W2]} failed. Waiting ${RETRY_AFTER[1]}...`);
			pids[IDS.W1].forEach(pid => ns.kill(pid));
			await ns.sleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.W2] = result;
		}

		await ns.sleep(weakT - growT - SAFETY_DELAY - extraT);

		if(level !== ns.getPlayer().skills.hacking)
			extraT += await SleepLevelChange(ns, target, IDS.G, growT);

		result = RunScript(ns, "grow.js", target, threads[IDS.G]);

		if(result.length === 0) {
			ns.print(`${CONSOLE_COLORS[IDS.G]}[!] Grow x${threads[IDS.G]} failed. Waiting ${RETRY_AFTER[1]}...`);
			Object.values(pids).flat().forEach(pid => ns.kill(pid));
			await ns.sleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.G] = result;
		}

		await ns.sleep(growT - hackT - (SAFETY_DELAY * 2) - extraT);

		if(level !== ns.getPlayer().skills.hacking)
			extraT += await SleepLevelChange(ns, target, IDS.H, hackT);

		result = RunScript(ns, "hack.js", target, threads[IDS.H]);

		if(result.length === 0) {
			ns.print(`${CONSOLE_COLORS[IDS.H]}[!] Hack x${threads[IDS.H]} failed. Waiting ${RETRY_AFTER[1]}...`);
			Object.values(pids).flat().forEach(pid => ns.kill(pid));
			await ns.sleep(RETRY_AFTER[0]);

			continue;
		}else{
			pids[IDS.H] = result;
		}

		for(let id = IDS.W1; id <= IDS.H; id++)
			SleepPids(ns, pids[id]).then(() => ns.print(`${CONSOLE_COLORS[id]}[${id}] ${GetName(id)} ended.`));

		await ns.sleep(SAFETY_DELAY);
		ns.print(`${CONSOLE_COLORS[IDS.H + 1]}[-] Batch completed.`);
	}
}