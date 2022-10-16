import {NS, Server, Player} from "@ns";
import Maybe, {just, nothing} from "@true-myth/maybe";
import {
	JOB_SPACER, HACK_LEVEL_RANGE, SEC_PER_THREAD, LEECH_PERCENTS
} from "utility/constants";
import {Task} from "utility/enums";
import {ScanAll} from "utility/misc";
import RAM from "utility/ram";
import {CalcStalefish} from "utility/stalefish";

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
	let depth = 0;

	for(; depth < limit; depth++) {
		if(ram.Reserve(Task.Weak1, threads[Task.Weak1]).isNothing)
			break;
		else if(ram.Reserve(Task.Weak2, threads[Task.Weak2]).isNothing)
			break;
		else if(ram.Reserve(Task.Grow, threads[Task.Grow]).isNothing)
			break;
		else if(ram.Reserve(Task.Hack, threads[Task.Hack]).isNothing)
			break;
	}

	return depth;
}

interface Metrics {
	profit: number;
	leech: number;
	period: number;
	depth: number;
}

export function GetMetrics(ns: NS, hostname: string) {
	let metrics: Maybe<Metrics> = nothing();

	for(const leech of LEECH_PERCENTS) {
		const limit = GetDepthLimit(ns, hostname, leech);

		if(limit === 0)
			break;

		const server = ns.getServer(hostname);

		server.hackDifficulty = server.minDifficulty;

		const chance = ns.formulas.hacking.hackChance(server, ns.getPlayer());
		const stalefish = CalcStalefish(ns, hostname, limit).unwrapOr(false);

		if(stalefish === false)
			break;

		const profit = server.moneyMax * chance * leech * stalefish.depth / (stalefish.period * stalefish.depth / 1e3);

		if(metrics.mapOr(true, m => profit > m.profit)) {
			metrics = just({
				profit,
				leech,
				period: stalefish.period,
				depth: stalefish.depth
			});
		}
	}

	return metrics;
}

interface Best {
	hostname: string;
	score: number;
}

export function GetXPServer(ns: NS) {
	const servers = ScanAll(ns).map(hostname => ns.getServer(hostname)).filter(server => server.hasAdminRights);
	const player = ns.getPlayer();
	let best: Maybe<Best> = nothing();

	for(const server of servers) {
		server.hackDifficulty = server.minDifficulty;

		const score = ns.formulas.hacking.hackExp(server, player) / ns.formulas.hacking.growTime(server, player);

		if(best.mapOr(true, b => score > b.score))
			best = just({hostname: server.hostname, score});
	}

	return best.map(b => b.hostname);
}