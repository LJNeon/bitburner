import {NS, Server} from "@ns";
import {
	HACK_LEVEL_RANGE, BATCH_PORT, SAFE_THRESHOLD, TYPE_ORDER
} from "utility/constants";
import {
	Task, TaskRecord, Stage, Color
} from "utility/enums";
import {
	GenID, nFormat, Table, ClearLastLogs,
	ReadPortIDs, CheckPids, Impossible
} from "utility/misc";
import {
	GetWeakThreads, GetGrowThreads, GetThreads, GetMetrics
} from "utility/metrics";
import {RunScript} from "utility/run-script";
import {CalcDelays} from "utility/stalefish";

function PrintPreparations(ns: NS, server: Server) {
	const done = server.hackDifficulty === server.minDifficulty && server.moneyAvailable === server.moneyMax;
	const rows = new Map<string, string>();

	ClearLastLogs(ns, 1, Color.Warn);
	rows.set("Security", `${nFormat(server.hackDifficulty, "l", 2)}/${nFormat(server.minDifficulty, "l", 2)}`);
	rows.set("Cash", `$${nFormat(server.moneyAvailable)}/$${nFormat(server.moneyMax)}`);
	ns.print(Table(`PREPAR${done ? "ED" : "ING"}`, rows, Color.Warn));
}

async function Prepare(ns: NS, hostname: string) {
	let id: number;
	let ongoing = 0;

	while(true) {
		await ns.asleep(5);

		if(ongoing !== 0) {
			ongoing -= ReadPortIDs(ns, BATCH_PORT).filter(i => i === id).length;

			if(ongoing !== 0)
				continue;
		}

		const server = ns.getServer(hostname);

		if(server.hackDifficulty !== server.minDifficulty) {
			id = GenID();
			ongoing = RunScript(
				ns,
				Task.Weak1,
				GetWeakThreads(server.hackDifficulty - server.minDifficulty),
				true,
				true,
				hostname,
				id,
				BATCH_PORT
			).length;
			PrintPreparations(ns, server);
		}else if(server.moneyAvailable !== server.moneyMax) {
			id = GenID();
			ongoing = RunScript(
				ns,
				Task.Grow,
				GetGrowThreads(ns, server, ns.getPlayer()),
				true,
				true,
				hostname,
				id,
				BATCH_PORT
			).length;
			PrintPreparations(ns, server);
		}else{
			PrintPreparations(ns, server);

			break;
		}
	}
}

interface ScheduleInfo {
	type: Task;
	createdAt: number;
	run: (lateBy: number) => void;
}

class Scheduler {
	#delays = TaskRecord(0);
	#tasks = new Map<number, ScheduleInfo>();

	Add(type: Task, createdAt: number, run: (lateBy: number) => void) {
		const id = GenID();

		this.#tasks.set(id, {type, createdAt, run});

		return id;
	}

	Has(id: number) {
		return this.#tasks.has(id);
	}

	Cancel(id: number) {
		return this.#tasks.delete(id);
	}

	Adjust(delays: Record<Task, number>) {
		for(const type of Object.keys(this.#delays) as Task[])
			this.#delays[type] = delays[type];
	}

	Run(now: number) {
		for(const [id, task] of this.#tasks) {
			const delay = this.#delays[task.type];

			if(task.createdAt + delay <= now) {
				this.#tasks.delete(id);
				task.run(now - task.createdAt - delay);
			}
		}
	}
}

interface TaskInfo {
	type: Task;
	pids: number[];
	done: number;
}

class Batch {
	cancelled = false;
	partial = 0;
	scheduled = new Map<Task, number>();
	running = new Map<number, TaskInfo>();
	finished: Task[] = [];

	TryFinish(id: number) {
		const task = this.running.get(id);

		if(task == null)
			return {found: false};

		++task.done;

		if(task.done === task.pids.length) {
			this.finished.push(task.type);

			return {found: true, type: task.type};
		}

		return {found: true};
	}

	Killed(ns: NS) {
		if(this.cancelled)
			return false;

		return Array.from(this.running.values())
			.some(info => !this.finished.includes(info.type) && CheckPids(ns, info.pids));
	}

	Cancel(ns: NS, scheduler: Scheduler) {
		for(const id of this.scheduled.values())
			scheduler.Cancel(id);

		for(const {pids} of this.running.values())
			pids.forEach(pid => ns.kill(pid));

		this.cancelled = true;
	}

	Desynced() {
		return TYPE_ORDER[this.partial].some((type, i) => this.finished[i] !== type);
	}
}

class Batcher {
	/*. Inputs .*/
	#ns;
	#hostname;
	#debug;
	/*. State .*/
	#stage = Stage.Preparing;
	#scheduler = new Scheduler();
	#batches = new Map<number, Batch>();
	#createdAt;
	#lastPrint;
	/*. Metrics .*/
	#level;
	#maxLevel;
	#leech;
	#profit;
	#period;
	#depth;
	#threads;
	/*. Stats .*/
	#started = 0;
	#finished = 0;
	#killed = 0;
	#late = 0;
	#desynced = 0;

	constructor(ns: NS, hostname: string, debug: boolean) {
		this.#ns = ns;
		this.#hostname = hostname;
		this.#debug = debug;
		this.#createdAt = performance.now();
		this.#stage = Stage.Running;
		this.#level = this.#ns.getPlayer().skills.hacking;
		this.#maxLevel = this.#level + HACK_LEVEL_RANGE - 1;

		const metrics = GetMetrics(this.#ns, this.#hostname).unwrapOrElse(() => {throw Error();});

		this.#leech = metrics.leech;
		this.#profit = metrics.profit;
		this.#period = metrics.period;
		this.#depth = metrics.depth;
		this.#threads = TaskRecord(0);
		this.#Adjust();
		this.#lastPrint = this.#createdAt;
		this.#Print();
	}

	#Debug(info: unknown) {
		if(!this.#debug)
			return;

		this.#ns.write(`debug-${Math.floor(this.#createdAt)}.txt`, `${JSON.stringify(info)}\n`, "a");
	}

	#Adjust() {
		this.#threads = GetThreads(this.#ns, this.#ns.getServer(this.#hostname), this.#ns.getPlayer(), this.#leech);
		this.#scheduler.Adjust(CalcDelays(this.#ns, this.#hostname, this.#period, this.#depth));
		this.#Debug({event: "adjusted", level: this.#level, threads: this.#threads});
	}

	#CancelOldest(grow = false) {
		let cancelled = false;

		for(const batch of this.#batches.values()) {
			if(batch.partial > 0) {
				cancelled = true;

				break;
			}else if(batch.running.size === 4 && batch.finished.length === 0) {
				cancelled = true;
				batch.partial = 1 + Number(grow);

				for(const info of batch.running.values()) {
					if(info.type === Task.Hack || (grow && info.type === Task.Grow))
						info.pids.forEach(pid => this.#ns.kill(pid));
				}
			}
		}

		return cancelled;
	}

	#Execute(batchID: number, batch: Batch, type: Task, lateBy: number) {
		const server = this.#ns.getServer(this.#hostname);

		if(server.hackDifficulty !== server.minDifficulty) {
			this.#CancelOldest(true);
			batch.Cancel(this.#ns, this.#scheduler);

			return;
		}else if(server.moneyAvailable !== server.moneyMax && this.#CancelOldest()) {
			return;
		}else if(lateBy >= SAFE_THRESHOLD) {
			batch.Cancel(this.#ns, this.#scheduler);
			++this.#late;

			return;
		}

		const id = GenID();
		const pids = RunScript(
			this.#ns,
			type,
			this.#threads[type],
			type === Task.Weak1 || type === Task.Weak2,
			false,
			this.#hostname,
			id,
			BATCH_PORT
		);

		batch.running.set(id, {type, pids, done: 0});
		this.#Debug({event: "executed", batchID, type});
	}

	#Start(at: number) {
		const batchID = GenID();
		const batch = new Batch();

		for(const type of Object.keys(this.#threads) as Task[]) {
			batch.scheduled.set(type, this.#scheduler.Add(type, at, lateBy => this.#Execute(batchID, batch, type, lateBy)));
			this.#Debug({event: "scheduled", batchID, type});
		}

		this.#batches.set(batchID, batch);
		++this.#started;
	}

	#Process(now: number) {
		/*. Run any scheduled tasks that are ready to be executed .*/
		this.#scheduler.Run(now);

		/*. Read the port to handle tasks that have finished .*/
		for(const id of ReadPortIDs(this.#ns, BATCH_PORT)) {
			for(const [batchID, batch] of this.#batches) {
				const result = batch.TryFinish(id);

				if(result.found) {
					if(result.type != null)
						this.#Debug({event: "finished", id: batchID, type: result.type});

					break;
				}
			}
		}

		for(const [batchID, batch] of this.#batches) {
			/*. Check for tasks killed by another script .*/
			if(batch.Killed(this.#ns)) {
				batch.Cancel(this.#ns, this.#scheduler);
				++this.#killed;
				this.#Debug({event: "killed", id: batchID});
			}

			/*. Delete batches that are either cancelled or completed .*/
			if(batch.finished.length === 4 - batch.partial) {
				if(batch.Desynced())
					++this.#desynced;
				else if(batch.partial === 0)
					++this.#finished;

				this.#batches.delete(batchID);
			}else if(batch.cancelled) {
				this.#batches.delete(batchID);
			}
		}
	}

	#Stop() {
		this.#stage = Stage.Stopping;

		/*. Cancel all batches that haven't ran all four tasks yet .*/
		for(const batch of this.#batches.values()) {
			if(batch.running.size !== 4)
				batch.Cancel(this.#ns, this.#scheduler);
		}
	}

	#Print() {
		const rows = new Map<string, string>();
		let color = Color.Warn;

		if(this.#stage === Stage.Running) {
			const info = this.#ns.getRunningScript();

			if(info == null)
				throw Impossible();

			const infoPct = nFormat(info.onlineMoneyMade / info.onlineRunningTime / this.#profit * 100, "l", 2);

			color = Color.Success;
			ClearLastLogs(this.#ns, 1, Color.Success);
			rows.set("Batch Duration", this.#ns.tFormat(this.#period * this.#depth));
			rows.set("Max Depth", nFormat(this.#depth, "l"));
			rows.set("Leech Percent", nFormat(this.#leech * 100, "l"));
			rows.set("Profits", `$${nFormat(info.onlineMoneyMade / info.onlineRunningTime * 60)}/min (${infoPct}%)`);
		}else{
			color = Color.Fail;
			ClearLastLogs(this.#ns, 1);

			if(this.#batches.size !== 0)
				rows.set("Remaining Batches", String(this.#batches.size));
		}

		let total = this.#finished + this.#killed + this.#late;

		total = total === 0 ? 1 : total;
		rows.set("Finished Batches", `${nFormat(this.#finished, "l")} (${nFormat(this.#finished / total * 100, "l", 2)}%)`);
		rows.set("Late Batches", `${nFormat(this.#late, "l")} (${nFormat(this.#late / total * 100, "l", 2)}%)`);
		rows.set("Killed Batches", `${nFormat(this.#killed, "l")} (${nFormat(this.#killed / total * 100, "l", 2)}%)`);
		rows.set("Desynced Batches", `${nFormat(this.#desynced, "l")} (${nFormat(this.#desynced / total * 100, "l", 2)}%)`);
		this.#ns.print(Table(this.#stage.toUpperCase(), rows, color));
	}

	async Run() {
		while(true) {
			await this.#ns.asleep(5);

			const now = performance.now();

			if(this.#stage === Stage.Stopping) {
				this.#Process(now);

				continue;
			}

			const level = this.#ns.getPlayer().skills.hacking;

			if(level > this.#maxLevel) {
				this.#Stop();

				continue;
			}else if(this.#level !== level) {
				this.#level = level;
				this.#Adjust();
			}

			const nextAt = this.#createdAt + (this.#period * this.#started);

			if(nextAt <= now)
				this.#Start(nextAt);

			this.#Process(now);

			if(now - this.#lastPrint >= 500)
				this.#Print();
		}
	}

	Exit() {
		if(this.#stage === Stage.Preparing)
			return;

		for(const batch of this.#batches.values())
			batch.Cancel(this.#ns, this.#scheduler);
	}
}

export async function main(ns: NS) {
	ns.disableLog("ALL");
	ns.tail();

	if(ns.args.length === 0)
		return ns.tprint(`${Color.Fail}[!] Server must be specified.`);

	const hostname = String(ns.args[0]);
	const debug = Boolean(ns.args[1]);
	let batcher: Batcher | null;
	let server;

	try {
		server = ns.getServer(hostname);
	}catch{
		return ns.tprint(`${Color.Fail}[!] Server "${hostname}" doesn't exist.`);
	}

	if(!server.hasAdminRights)
		return ns.tprint(`${Color.Fail}[!] Missing root access for "${hostname}".`);

	ns.atExit(() => batcher?.Exit());

	while(true) {
		await Prepare(ns, hostname);

		try {
			batcher = new Batcher(ns, hostname, debug);
		}catch{
			return ns.print(`${Color.Fail}Failed to calculate metrics, exiting...`);
		}

		await batcher.Run();
	}
}