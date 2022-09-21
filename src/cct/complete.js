import {TAIL_COLORS, DEFAULT_COLOR} from "constants.js";
import {ScanAll} from "utility.js";

function VigenereCipher(data) {
	const [plaintext, keyword] = data;

	return plaintext
		.split("")
		.map((c, i) => {
			if(c === " ")
				return " ";

			return String.fromCharCode(((c.charCodeAt(0) - 130 + keyword.charCodeAt(i % keyword.length)) % 26) + 65);
		})
		.join("");
}

function JumpingGameI(data) {
	if(data[0] === 0)
		return 0;

	const jumps = [1];

	for(let n = 0; n < data.length; n++) {
		if(jumps[n]) {
			for(let p = n; p <= Math.min(n + data[n], data.length - 1); p++)
				jumps[p] = 1;
		}
	}

	return Number(Boolean(jumps[data.length - 1]));
}

function JumpingGameII(data) {
	const n = data.length;
	let reach = 0;
	let jumps = 0;
	let lastJump = -1;

	while(reach < n - 1) {
		let jumpedFrom;

		for(let i = reach; i > lastJump; i--) {
			if(i + data[i] > reach) {
				reach = i + data[i];
				jumpedFrom = i;
			}
		}

		if(jumpedFrom == null) {
			jumps = 0;

			break;
		}

		lastJump = jumpedFrom;
		++jumps;
	}

	return jumps;
}

function IsValidIPSegment(segment) {
	if(segment[0] === "0" && segment !== "0")
		return false;

	const num = Number(segment);

	return num >= 0 && num <= 255;
}

function GenerateIPAddresses(number) {
	const num = number.toString();
	const length = num.length;
	const ips = [];

	for(let i = 1; i < length - 2; i++) {
		for(let j = i + 1; j < length - 1; j++) {
			for(let k = j + 1; k < length; k++) {
				const ip = [
					num.slice(0, i),
					num.slice(i, j),
					num.slice(j, k),
					num.slice(k, num.length)
				];

				if(ip.every(seg => IsValidIPSegment(seg)))
					ips.push(ip.join("."));
			}
		}
	}

	return ips.toString();
}

function FactorialDivision(n, d) {
	if(n === 0 || n === 1 || n === d)
		return 1;

	return FactorialDivision(n - 1, d) * n;
}

function UniquePathsI(grid) {
	const rightMoves = grid[0] - 1;
	const downMoves = grid[1] - 1;

	return Math.round(FactorialDivision(rightMoves + downMoves, rightMoves) / FactorialDivision(downMoves, 1));
}

function UniquePathsII(grid, ignoreFirst = false, ignoreLast = false) {
	const rightMoves = grid[0].length - 1;
	const downMoves = grid.length - 1;
	let total = Math.round(FactorialDivision(rightMoves + downMoves, rightMoves) / FactorialDivision(downMoves, 1));

	for(let i = 0; i < grid.length; i++) {
		for(let j = 0; j < grid[i].length; j++) {

			if(grid[i][j] === 1 && (!ignoreFirst || (i !== 0 || j !== 0))
					&& (!ignoreLast || (i !== grid.length - 1 || j !== grid[i].length - 1))) {
				const newArray = [];

				for(let k = i; k < grid.length; k++)
					newArray.push(grid[k].slice(j, grid[i].length));

				let removedPaths = UniquePathsII(newArray, true, ignoreLast);

				removedPaths *= UniquePathsI([i + 1, j + 1]);
				total -= removedPaths;
			}
		}

	}

	return total;
}

function WaysToSumI(data) {
	const ways = [];

	ways[0] = 1;

	for(let i = 1; i <= data; i++)
		ways[i] = 0;

	for(let i = 1; i <= data - 1; i++) {
		for(let j = i; j <= data; j++)
			ways[j] += ways[j - i];
	}

	return ways[data];
}

function WaysToSumII(data) {
	const [num, nums] = data;
	const ways = [];

	ways[0] = 1;

	for(let i = 1; i <= num; i++)
		ways[i] = 0;

	for(const i of nums) {
		if(i > num)
			continue;

		for(let j = i; j <= num; j++)
			ways[j] += ways[j - i];
	}

	return ways[num];
}

function ValidMathExpressions(data) {
	const operators = ["", "+", "-", "*"];
	const permutations = Math.pow(4, data[0].length - 1);
	const valid = [];

	for(let i = 0; i < permutations; i++) {
		const summands = [];
		let candidate = data[0].substr(0, 1);

		summands[0] = Number(data[0].substr(0, 1));

		for(let j = 1; j < data[0].length; j++) {
			candidate += operators[(i >> ((j - 1) * 2)) % 4] + data[0].substr(j, 1);

			let operand = Number(data[0].substr(j, 1));

			switch(operators[(i >> ((j - 1) * 2)) % 4]) {
				case "":
					operand *= summands[summands.length - 1] / Math.abs(summands[summands.length - 1]);
					summands[summands.length - 1] = (summands[summands.length - 1] * 10) + operand;

					break;
				case "+":
					summands[summands.length] = operand;

					break;
				case "-":
					summands[summands.length] = 0 - operand;

					break;
				case "*":
					while(j < data[0].length - 1 && ((i >> (j * 2)) % 4) === 0) {
						j += 1;
						candidate += data[0].substr(j, 1);
						operand = (operand * 10) + Number(data[0].substr(j, 1));
					}

					summands[summands.length - 1] = summands[summands.length - 1] * operand;

					break;
			}
		}

		if(data[1] === summands.reduce((a, b) => a + b))
			valid.push(candidate);

	}

	return valid.toString();
}

function MinTriangleSum(data) {
	let previous = data[0];
	let next;

	for(let i = 1; i < data.length; i++) {
		next = [];

		for(let j = 0; j < data[i].length; j++) {
			if(j === 0)
				next.push(previous[j] + data[i][j]);
			else if(j === data[i].length - 1)
				next.push(previous[j - 1] + data[i][j]);
			else
				next.push(Math.min(previous[j], previous[j - 1]) + data[i][j]);

		}

		previous = next;
	}

	return Math.min(...next);
}

function ShortestPathInGrid(data) {
	const H = data.length;
	const W = data[0].length;
	const dist = Array.from(Array(H), () => Array(W).fill(Number.POSITIVE_INFINITY));

	dist[0][0] = 0;

	const queue = [[0, 0]];

	while(queue.length > 0) {
		const [i, j] = queue.shift();
		const d = dist[i][j];

		if(i > 0 && d + 1 < dist[i - 1][j] && data[i - 1][j] !== 1) {
			dist[i - 1][j] = d + 1;
			queue.push([i - 1, j]);
		}

		if(i < H - 1 && d + 1 < dist[i + 1][j] && data[i + 1][j] !== 1) {
			dist[i + 1][j] = d + 1;
			queue.push([i + 1, j]);
		}

		if(j > 0 && d + 1 < dist[i][j - 1] && data[i][j - 1] !== 1) {
			dist[i][j - 1] = d + 1;
			queue.push([i, j - 1]);
		}

		if(j < W - 1 && d + 1 < dist[i][j + 1] && data[i][j + 1] !== 1) {
			dist[i][j + 1] = d + 1;
			queue.push([i, j + 1]);
		}
	}

	let path = "";

	if(Number.isFinite(dist[H - 1][W - 1])) {
		let i = H - 1; let j = W - 1;

		while(i !== 0 || j !== 0) {
			let d = dist[i][j];
			let new_i = 0;
			let new_j = 0;
			let dir = "";

			if(i > 0 && dist[i - 1][j] < d) {
				d = dist[i - 1][j];
				new_i = i - 1;
				new_j = j;
				dir = "D";
			}else if(i < H - 1 && dist[i + 1][j] < d) {
				d = dist[i + 1][j];
				new_i = i + 1;
				new_j = j;
				dir = "U";
			}else if(j > 0 && dist[i][j - 1] < d) {
				d = dist[i][j - 1];
				new_i = i;
				new_j = j - 1;
				dir = "R";
			}else if(j < W - 1 && dist[i][j + 1] < d) {
				d = dist[i][j + 1];
				new_i = i;
				new_j = j + 1;
				dir = "L";
			}

			i = new_i;
			j = new_j;
			path = dir + path;
		}
	}

	return path;
}

function dfs(pair, index, left, right, s, solution, res) {
	if(s.length === index) {
		if(left === 0 && right === 0 && pair === 0) {
			for(let i = 0; i < res.length; i++) {
				if(res[i] === solution)
					return;

			}

			res.push(solution);
		}

		return;
	}

	if(s[index] === "(") {
		if(left > 0)
			dfs(pair, index + 1, left - 1, right, s, solution, res);

		dfs(pair + 1, index + 1, left, right, s, solution + s[index], res);
	}else if(s[index] === ")") {
		if(right > 0)
			dfs(pair, index + 1, left, right - 1, s, solution, res);

		if(pair > 0)
			dfs(pair - 1, index + 1, left, right, s, solution + s[index], res);
	}else{
		dfs(pair, index + 1, left, right, s, solution + s[index], res);
	}
}

function SanitizeParentheses(data) {
	const res = [];
	let left = 0;
	let right = 0;

	for(let i = 0; i < data.length; ++i) {
		if(data[i] === "(")
			++left;
		else if(data[i] === ")")
			left > 0 ? --left : ++right;
	}

	dfs(0, 0, left, right, data, "", res);

	return res;
}

function HammingSumOfParity(length) {
	return length < 3 || length === 0
		? length === 0 ? 0 : length + 1
		: Math.ceil(Math.log2(length * 2)) <= Math.ceil(Math.log2(1 + length + Math.ceil(Math.log2(length))))
			? Math.ceil(Math.log2(length) + 1)
			: Math.ceil(Math.log2(length));
}

function HammingCount(arr, val) {
	return arr.reduce((a, v) => v === val ? a + 1 : a, 0);
}

function HammingEncode(data) {
	const dataBits = data.toString(2);
	const bits = dataBits.split("");
	const build = [];

	build.push("x", "x", ...bits.splice(0, 1));

	for(let i = 2; i < HammingSumOfParity(dataBits.length); i++)
		build.push("x", ...bits.splice(0, Math.pow(2, i) - 1));

	for(const index of build.reduce((a, e, i) => (e === "x" ? a.push(i) : i) && a, [])) {
		const tempCount = index + 1;
		const tempArray = [];
		const tempData = [...build];

		while(tempData[index] !== undefined) {
			const _temp = tempData.splice(index, tempCount * 2);

			tempArray.push(..._temp.splice(0, tempCount));
		}

		tempArray.splice(0, 1);
		build[index] = (HammingCount(tempArray, "1") % 2).toString();
	}

	build.unshift((HammingCount(build, "1") % 2).toString());

	return build.join("");
}

function HammingDecode(data) {
	const build = data.split("");
	const testArray = [];
	const sumParity = Math.ceil(Math.log2(data.length));
	let overallParity = build.splice(0, 1).join("");

	testArray.push(overallParity === (HammingCount(build, "1") % 2).toString() ? true : false);

	for(let i = 0; i < sumParity; i++) {
		const _tempIndex = Math.pow(2, i) - 1;
		const _tempStep = _tempIndex + 1;
		const _tempData = [...build];
		const _tempArray = [];

		while(_tempData[_tempIndex] != null) {
			const _temp = [..._tempData.splice(_tempIndex, _tempStep * 2)];

			_tempArray.push(..._temp.splice(0, _tempStep));
		}

		const _tempParity = _tempArray.shift();

		testArray.push(_tempParity === (HammingCount(_tempArray, "1") % 2).toString() ? true : false);
	}

	let _fixIndex = 0;

	for(let i = 1; i < sumParity + 1; i++)
		_fixIndex += testArray[i] ? 0 : Math.pow(2, i) / 2;

	build.unshift(overallParity);

	if(_fixIndex > 0 && !testArray[0])
		build[_fixIndex] = build[_fixIndex] === "0" ? "1" : "0";
	else if(!testArray[0])
		overallParity = overallParity === "0" ? "1" : "0";
	else if(testArray[0] && testArray.some(truth => truth === false))
		return 0;

	for(let i = sumParity; i >= 0; i--)
		build.splice(Math.pow(2, i), 1);

	build.splice(0, 1);

	return parseInt(build.join(""), 2);
}

function LargestPrimeFactor(data) {
	const factors = [];
	let num = data;
	let d = 2;

	while(num > 1) {
		while(num % d === 0) {
			factors.push(d);
			num /= d;
		}

		d = d + 1;

		if(d * d > num) {
			if(num > 1)
				factors.push(num);

			break;
		}
	}

	if(factors.length > 0)
		return factors.pop();

	return "";
}

/** @param {import("../").NS} ns */
function FindContracts(ns) {
	return ScanAll(ns)
		.map(name => ({name, contracts: ns.ls(name, ".cct")}))
		.filter(server => server.contracts.length !== 0);
}

/** @param {import("../").NS} ns */
async function AnswerContract(ns, server, contract) {
	const type = ns.codingcontract.getContractType(contract, server);
	const data = ns.codingcontract.getData(contract, server);

	switch(type) {
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
		default:
			ns.print(`${DEFAULT_COLOR}${type} ${TAIL_COLORS[3]}${contract}`);

			throw Error("not implemented");
	}
}

/** @param {import("../").NS} ns */
export async function main(ns) {
	ns.disableLog("disableLog");
	ns.disableLog("scan");
	ns.disableLog("sleep");

	while(true) {
		const now = performance.now();
		const servers = FindContracts(ns);
		let success = 0;
		let total = 0;

		for(const server of servers) {
			for(const contract of server.contracts) {
				try {
					const answer = await AnswerContract(ns, server.name, contract);

					success += Number(ns.codingcontract.attempt(answer, contract, server.name));
					++total;
				}catch{}
			}
		}

		if(total === 0)
			ns.print(`${DEFAULT_COLOR}Found no CCTs to complete.`);
		else
			ns.print(`${DEFAULT_COLOR}Completed ${success}/${total} CCTs in ${ns.tFormat(performance.now() - now)}.`);

		await ns.sleep(6e5);
	}
}