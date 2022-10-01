import {
	RLECompress, LZDecompress, LZCompress, CaesarCipher,
	VigenereCipher, JumpingGameI, JumpingGameII, GenerateIPAddresses,
	UniquePathsI, UniquePathsII, WaysToSumI, WaysToSumII,
	ValidMathExpressions, MinTriangleSum, ShortestPathInGrid, SanitizeParentheses,
	HammingEncode, HammingDecode, LargestPrimeFactor, StockTrader,
	MergeIntervals, ColoringOfGraph, SpiralMatrix, SubarrayMaxSum
} from "cct/solvers.js";
import {DEFAULT_COLOR} from "utility/constants.js";
import {ScanAll, nFormat} from "utility/misc.js";

/** @param {import("../").NS} ns */
function FindContracts(ns) {
	return ScanAll(ns)
		.map(name => ({name, contracts: ns.ls(name, ".cct")}))
		.filter(server => server.contracts.length !== 0);
}

function AnswerContract(type, data) {
	switch(type) {
		case "Compression I: RLE Compression":
			return RLECompress(data);
		case "Compression II: LZ Decompression":
			return LZDecompress(data);
		case "Compression III: LZ Compression":
			return LZCompress(data);
		case "Encryption I: Caesar Cipher":
			return CaesarCipher(data);
		case "Encryption II: Vigenère Cipher":
			return VigenereCipher(data);
		case "Array Jumping Game":
			return JumpingGameI(data);
		case "Array Jumping Game II":
			return JumpingGameII(data);
		case "Generate IP Addresses":
			return GenerateIPAddresses(data);
		case "Unique Paths in a Grid I":
			return UniquePathsI(data);
		case "Unique Paths in a Grid II":
			return UniquePathsII(data);
		case "Total Ways to Sum":
			return WaysToSumI(data);
		case "Total Ways to Sum II":
			return WaysToSumII(data);
		case "Find All Valid Math Expressions":
			return ValidMathExpressions(data);
		case "Minimum Path Sum in a Triangle":
			return MinTriangleSum(data);
		case "Shortest Path in a Grid":
			return ShortestPathInGrid(data);
		case "Sanitize Parentheses in Expression":
			return SanitizeParentheses(data);
		case "HammingCodes: Integer to Encoded Binary":
			return HammingEncode(data);
		case "HammingCodes: Encoded Binary to Integer":
			return HammingDecode(data);
		case "Find Largest Prime Factor":
			return LargestPrimeFactor(data);
		case "Algorithmic Stock Trader I":
			return StockTrader([1, data]);
		case "Algorithmic Stock Trader II":
			return StockTrader([Math.ceil(data.length / 2), data]);
		case "Algorithmic Stock Trader III":
			return StockTrader([2, data]);
		case "Algorithmic Stock Trader IV":
			return StockTrader(data);
		case "Merge Overlapping Intervals":
			return MergeIntervals(data);
		case "Proper 2-Coloring of a Graph":
			return ColoringOfGraph(data);
		case "Spiralize Matrix":
			return SpiralMatrix(data);
		case "Subarray with Maximum Sum":
			return SubarrayMaxSum(data);
		default:
			throw Error(`MISSING TYPE! ${type}`);
	}
}

class Rewards {
	constructor() {
		this.money = 0;
		this.companies = new Map();
		this.all = 0;
		this.factions = new Map();
	}

	add(ns, reward) {
		const start = reward.indexOf(" ") + 1;

		if(reward.includes("faction reputation")) {
			const faction = reward.slice(reward.indexOf("for") + 4);
			const amount = Number(reward.slice(start, reward.indexOf(" ", start)));

			this.factions.set(faction, (this.factions.get(faction) ?? 0) + amount);
		}else if(reward.includes("reputation for each")) {
			this.all += Number(reward.slice(start, reward.indexOf(" ", start)));
		}else if(reward.includes("$")) {
			this.money += Number(reward.slice(start + 1, -1)) * 1e6;
		}else{
			ns.tprint("UNLISTED REWARD! ", reward);
		}
	}

	list() {
		const results = [];

		if(this.money > 0)
			results.push(`$${nFormat(this.money)}`);

		for(const [name, rep] of this.companies.entries())
			results.push(`${nFormat(rep)} reputation for ${name}`);

		if(this.all > 0)
			results.push(`${nFormat(this.all)} reputation for all factions`);

		for(const [name, rep] of this.factions.entries())
			results.push(`${nFormat(rep)} reputation for ${name}`);

		return results.length === 1 ? ` ${results[0]}` : `\n  - ${results.join("\n  - ")}`;
	}
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const servers = FindContracts(ns);
	const rewards = new Rewards();
	let success = 0;
	let total = 0;

	for(const {name, contracts} of servers) {
		for(const contract of contracts) {
			const type = ns.codingcontract.getContractType(contract, name);
			const data = ns.codingcontract.getData(contract, name);
			let answer;

			try {
				answer = AnswerContract(type, data);
			}catch(err) {
				ns.tprint(`${DEFAULT_COLOR}${err.message}`);

				continue;
			}

			const reward = ns.codingcontract.attempt(answer, contract, name, {returnReward: true});

			if(reward === "") {
				ns.tprint(`${DEFAULT_COLOR}FAILED CONTRACT! Type: ${type} Data: ${JSON.stringify(data)}`);
			}else{
				++success;
				rewards.add(ns, reward);
			}

			++total;
		}
	}

	if(total === 0)
		ns.tprint(`${DEFAULT_COLOR}Found no CCTs to complete.`);
	else
		ns.tprint(`${DEFAULT_COLOR}Completed ${success}/${total} CCTs for these rewards:${rewards.list()}`);
}