import {NS, Server, Player} from "@ns";
import {
	JOB_SPACER, HACK_LEVEL_RANGE, SEC_PER_THREAD, LEECH_PERCENTS,
	HACK_RAM, WEAKEN_GROW_RAM
} from "utility/constants";
import {Task} from "utility/enums";
import {ScanAll} from "utility/misc";
import RAM from "utility/ram";
import {CalcPeriodDepth} from "utility/stalefish";

export function GetWeakThreads(security: number) {
	return Math.ceil(security / SEC_PER_THREAD.WEAKEN);
}

function CalcGrowth(ns: NS, server: Server, player: Player, threads: number, cores: number) {
	const serverGrowth = ns.formulas.hacking.growPercent(server, threads, player, cores);

	return (server.moneyAvailable + threads) * serverGrowth;
}

function BinarySearchGrow(ns: NS, min: number, max: number, server: Server, player: Player, cores: number): number {
	if(min === max)
		return max;

	const threads = Math.ceil(min + ((max - min) / 2));
	const newMoney = CalcGrowth(ns, server, player, threads, cores);

	if(newMoney > server.moneyMax) {
		if(CalcGrowth(ns, server, player, threads - 1, cores) < server.moneyMax)
			return threads;

		return BinarySearchGrow(ns, min, threads - 1, server, player, cores);
	}else if(newMoney < server.moneyMax) {
		return BinarySearchGrow(ns, threads + 1, max, server, player, cores);
	}

	return threads;
}

export function GetGrowThreads(ns: NS, server: Server, player: Player, cores = 1) {
	if(server.moneyAvailable >= server.moneyMax || isNaN(server.moneyAvailable))
		return 0;

	const max = Math.ceil(Math.log(server.moneyMax)
		/ Math.log(ns.formulas.hacking.growPercent(server, 1, player, cores)));
	const threads = BinarySearchGrow(ns, 1, max, server, player, cores);
	const newMoney = CalcGrowth(ns, server, player, threads, cores);
	const diff = server.moneyMax - newMoney;

	if(diff > 0)
		ns.print(`Grow threads undershot by ${diff}.`);

	return threads;
}
export function GetHackThreads(ns: NS, server: Server, player: Player, pct: number) {
	return Math.floor(pct / ns.formulas.hacking.hackPercent(server, player));
}
export function GetThreads(ns: NS, server: Server, player: Player, pct: number): Record<Task, number> {
	server.hackDifficulty = server.minDifficulty;
	server.moneyAvailable = server.moneyMax;

	const hackThreads = GetHackThreads(ns, server, player, pct);

	server.moneyAvailable = server.moneyMax * (1 - pct);

	const growThreads = GetGrowThreads(ns, server, player);

	return {
		[Task.Weak1]: GetWeakThreads(hackThreads * SEC_PER_THREAD.HACK),
		[Task.Weak2]: GetWeakThreads(growThreads * SEC_PER_THREAD.GROW),
		[Task.Grow]: growThreads,
		[Task.Hack]: hackThreads
	};
}

function GetDepthLimit(ns: NS, target: string, pct: number) {
	const server = ns.getServer(target);
	const player = ns.getPlayer();

	server.hackDifficulty = server.minDifficulty;
	player.skills.hacking += HACK_LEVEL_RANGE;

	const weakT = ns.formulas.hacking.weakenTime(server, player);
	const limit = Math.floor(weakT / (JOB_SPACER * 8));
	const ram = new RAM(ns, true);
	const threads = GetThreads(ns, server, player, pct);
	const batchRam = ((threads[Task.Weak1] + threads[Task.Weak2] + threads[Task.Grow]) * WEAKEN_GROW_RAM)
		+ (threads[Task.Hack] * HACK_RAM);

	return Math.min(Math.floor(batchRam / (ram.free - ram.reserved)), limit);
}

export interface Metrics {
	hostname: string;
	profit: number;
	percent: number;
	period: number;
	depth: number;
}
export async function GetMetrics(ns: NS, hostname: string): Promise<Metrics | null> {
	let percent;
	let profit;
	let period;
	let depth;

	for(const hackPct of LEECH_PERCENTS) {
		const limit = GetDepthLimit(ns, hostname, hackPct);

		if(limit === 0)
			break;

		const server = ns.getServer(hostname);

		server.hackDifficulty = server.minDifficulty;

		const chance = ns.formulas.hacking.hackChance(server, ns.getPlayer());
		const sf = CalcPeriodDepth(ns, hostname, limit);

		if(sf == null)
			break;

		const nextProfit = server.moneyMax * chance * hackPct * sf.depth / (sf.period * sf.depth / 1e3);

		if(profit == null || nextProfit > profit) {
			percent = hackPct;
			profit = nextProfit;
			({period, depth} = sf);
		}

		await ns.sleep(0);
	}

	if(percent == null || profit == null || period == null || depth == null)
		return null;

	return {
		hostname,
		percent,
		profit,
		period,
		depth
	};
}
export function BestXPServer(ns: NS) {
	const servers = ScanAll(ns).map(n => ns.getServer(n));
	const player = ns.getPlayer();
	let best;
	let score;

	for(const server of servers) {
		server.hackDifficulty = server.minDifficulty;

		const nextScore = ns.formulas.hacking.hackExp(server, player) / ns.formulas.hacking.growTime(server, player);

		if(score == null || nextScore > score) {
			best = server.hostname;
			score = nextScore;
		}
	}

	return best;
}