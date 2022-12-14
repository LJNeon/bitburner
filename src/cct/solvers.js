/*.
 * I'm accepting PRs to convert this file to TypeScript.
 * Those who don't open a PR forfeit all rights to complain about this file.
 * PRs must also be fully tested.
.*/

export function RLECompress(data) {
	const chars = Array.from(data);
	let answer = "";
	let current = undefined;
	let count = 0;

	while(chars.length > 0) {
		const char = chars.shift();

		switch(current) {
			case undefined:
				current = char;
				count = 1;

				break;
			case char:
				if(count === 9) {
					answer = `${answer}${count}${current}`;
					count = 0;
				}

				count++;

				break;
			default:
				answer = `${answer}${count}${current}`;
				current = char;
				count = 1;

				break;
		}
	}

	answer = `${answer}${count}${current}`;

	return answer;
}
export function LZDecompress(data) {
	const compr = data;
	let plain = "";

	for(let i = 0; i < compr.length;) {
		const literalLength = compr.charCodeAt(i) - 0x30;

		if(literalLength < 0 || literalLength > 9 || i + 1 + literalLength > compr.length)
			return null;

		plain += compr.substring(i + 1, i + 1 + literalLength);
		i += 1 + literalLength;

		if(i >= compr.length)
			break;

		const backrefLength = compr.charCodeAt(i) - 0x30;

		if(backrefLength < 0 || backrefLength > 9) {
			return null;
		}else if(backrefLength === 0) {
			++i;
		}else{
			if(i + 1 >= compr.length)
				return null;

			const backrefOffset = compr.charCodeAt(i + 1) - 0x30;

			if((backrefLength > 0 && (backrefOffset < 1 || backrefOffset > 9)) || backrefOffset > plain.length)
				return null;

			for(let j = 0; j < backrefLength; ++j)
				plain += plain[plain.length - backrefOffset];

			i += 2;
		}
	}

	return plain;
}
export function SetLZ(state, i, j, str) {
	const current = state[i][j];

	if(current == null || str.length < current.length)
		state[i][j] = str;
	else if(str.length === current.length && Math.random() < 0.5)
		state[i][j] = str;
}
export function LZCompress(data) {
	const plain = data;
	let cur_state = Array.from(Array(10), () => Array(10).fill(null));
	let new_state = Array.from(Array(10), () => Array(10));

	cur_state[0][1] = "";

	for(let i = 1; i < plain.length; ++i) {
		for(const row of new_state)
			row.fill(null);

		const c = plain[i];

		for(let len = 1; len <= 9; ++len) {
			const string = cur_state[0][len];

			if(string == null)
				continue;

			if(len < 9)
				SetLZ(new_state, 0, len + 1, string);
			else
				SetLZ(new_state, 0, 1, `${string  }9${  plain.substring(i - 9, i)  }0`);

			for(let offset = 1; offset <= Math.min(9, i); ++offset) {
				if(plain[i - offset] === c)
					SetLZ(new_state, offset, 1, string + String(len) + plain.substring(i - len, i));

			}
		}

		for(let offset = 1; offset <= 9; ++offset) {
			for(let len = 1; len <= 9; ++len) {
				const string = cur_state[offset][len];

				if(string == null)
					continue;

				if(plain[i - offset] === c) {
					if(len < 9)
						SetLZ(new_state, offset, len + 1, string);
					else
						SetLZ(new_state, offset, 1, `${string  }9${  String(offset)  }0`);

				}

				SetLZ(new_state, 0, 1, string + String(len) + String(offset));

				for(let new_offset = 1; new_offset <= Math.min(9, i); ++new_offset) {
					if(plain[i - new_offset] === c)
						SetLZ(new_state, new_offset, 1, `${string + String(len) + String(offset)  }0`);

				}
			}
		}

		const tmp_state = new_state;

		new_state = cur_state;
		cur_state = tmp_state;
	}

	let result = null;

	for(let len = 1; len <= 9; ++len) {
		let string = cur_state[0][len];

		if(string == null)
			continue;

		string += String(len) + plain.substring(plain.length - len, plain.length);

		if(result == null || string.length < result.length)
			result = string;
		else if(string.length === result.length && Math.random() < 0.5)
			result = string;

	}

	for(let offset = 1; offset <= 9; ++offset) {
		for(let len = 1; len <= 9; ++len) {
			let string = cur_state[offset][len];

			if(string == null)
				continue;

			string += `${String(len)  }${  String(offset)}`;

			if(result == null || string.length < result.length)
				result = string;
			else if(string.length === result.length && Math.random() < 0.5)
				result = string;

		}
	}

	return result ?? "";
}
export function CaesarCipher(data) {
	const cipher = [...data[0]]
		.map((a) => a === " " ? a : String.fromCharCode(((a.charCodeAt(0) - 65 - data[1] + 26) % 26) + 65))
		.join("");

	return cipher;
}
export function VigenereCipher(data) {
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
export function JumpingGameI(data) {
	if(data[0] === 0)
		return "0";

	const jumps = [1];

	for(let n = 0; n < data.length; n++) {
		if(jumps.length > n) {
			for(let p = n; p <= Math.min(n + data[n], data.length - 1); p++)
				jumps[p] = 1;
		}
	}

	return Number(Boolean(jumps[data.length - 1]));
}
export function JumpingGameII(data) {
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
export function IsValidIPSegment(segment) {
	if(segment[0] === "0" && segment !== "0")
		return false;

	const num = Number(segment);

	return num >= 0 && num <= 255;
}
export function GenerateIPAddresses(number) {
	const num = number.toString();
	const len = num.length;
	const ips = [];

	for(let i = 1; i < len - 2; i++) {
		for(let j = i + 1; j < len - 1; j++) {
			for(let k = j + 1; k < len; k++) {
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
export function FactorialDivision(n, d) {
	if(n === 0 || n === 1 || n === d)
		return 1;

	return FactorialDivision(n - 1, d) * n;
}
export function UniquePathsI(grid) {
	const rightMoves = grid[0] - 1;
	const downMoves = grid[1] - 1;

	return Math.round(FactorialDivision(rightMoves + downMoves, rightMoves) / FactorialDivision(downMoves, 1));
}
export function UniquePathsII(grid, ignoreFirst = false, ignoreLast = false) {
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
export function WaysToSumI(data) {
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
export function WaysToSumII(data) {
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
export function ValidMathExpressions(data) {
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
export function MinTriangleSum(data) {
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
export function ShortestPathInGrid(data) {
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
export function dfs(pair, index, left, right, s, solution, res) {
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
export function SanitizeParentheses(data) {
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
export function HammingSumOfParity(len) {
	return len < 3 || len === 0
		? len === 0 ? 0 : len + 1
		: Math.ceil(Math.log2(len * 2)) <= Math.ceil(Math.log2(1 + len + Math.ceil(Math.log2(len))))
			? Math.ceil(Math.log2(len) + 1)
			: Math.ceil(Math.log2(len));
}
export function HammingCount(arr, val) {
	return arr.reduce((a, v) => v === val ? a + 1 : a, 0);
}
export function HammingEncode(data) {
	const dataBits = data.toString(2);
	const bits = dataBits.split("");
	const build = ["x", "x"];

	build.push(...bits.splice(0, 1));

	for(let i = 2; i < HammingSumOfParity(dataBits.length); i++)
		build.push("x", ...bits.splice(0, Math.pow(2, i) - 1));

	for(const index of build.reduce((a, e, i) => (e === "x" ? a.push(i) : 0, a), [])) {
		const tempCount = index + 1;
		const tempArray = [];
		const tempData = [...build];

		while(tempData.length > index) {
			const _temp = tempData.splice(index, tempCount * 2);

			tempArray.push(..._temp.splice(0, tempCount));
		}

		tempArray.splice(0, 1);
		build[index] = (HammingCount(tempArray, "1") % 2).toString();
	}

	build.unshift((HammingCount(build, "1") % 2).toString());

	return build.join("");
}
export function HammingDecode(data) {
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
export function LargestPrimeFactor(data) {
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
export function StockTrader(data) {
	const [maxTrades, stockPrices] = data;
	const highestProfit = [];

	for(let i = 0; i < maxTrades; i++)
		highestProfit.push(Array(stockPrices.length + 1).fill(0));

	for(let i = 0; i < maxTrades; i++) {
		for(let j = 0; j < stockPrices.length; j++) {
			for(let k = j; k < stockPrices.length; k++) {
				if(i > 0 && j > 0 && k > 0) {
					highestProfit[i][k] = Math.max(
						highestProfit[i][k],
						highestProfit[i - 1][k],
						highestProfit[i][k - 1],
						highestProfit[i - 1][j - 1] + stockPrices[k] - stockPrices[j]
					);
				}else if(i > 0 && j > 0) {
					highestProfit[i][k] = Math.max(
						highestProfit[i][k],
						highestProfit[i - 1][k],
						highestProfit[i - 1][j - 1] + stockPrices[k] - stockPrices[j]
					);
				}else if(i > 0 && k > 0) {
					highestProfit[i][k] = Math.max(
						highestProfit[i][k],
						highestProfit[i - 1][k],
						highestProfit[i][k - 1],
						stockPrices[k] - stockPrices[j]
					);
				}else if(j > 0 && k > 0) {
					highestProfit[i][k] = Math.max(highestProfit[i][k], highestProfit[i][k - 1], stockPrices[k] - stockPrices[j]);
				}else{
					highestProfit[i][k] = Math.max(highestProfit[i][k], stockPrices[k] - stockPrices[j]);
				}

			}
		}
	}

	return highestProfit[maxTrades - 1][stockPrices.length - 1];
}
export function MergeIntervals(data) {
	const intervals = data;

	intervals.sort(([minA], [minB]) => minA - minB);

	for(let i = 0; i < intervals.length; i++) {
		for(let j = i + 1; j < intervals.length; j++) {
			const [min, max] = intervals[i];
			const [laterMin, laterMax] = intervals[j];

			if(laterMin <= max) {
				const newMax = laterMax > max ? laterMax : max;
				const newInterval = [min, newMax];

				intervals[i] = newInterval;
				intervals.splice(j, 1);
				j = i;
			}
		}
	}

	return intervals;
}
export function Neighborhood(data, vertex) {
	const adjLeft = data[1].filter(([a, _]) => a === vertex).map(([_, b]) => b);
	const adjRight = data[1].filter(([_, b]) => b === vertex).map(([a, _]) => a);

	return adjLeft.concat(adjRight);
}
export function ColoringOfGraph(data) {
	const coloring = Array(data[0]).fill(undefined);

	while(coloring.some(val => val == null)) {
		const initialVertex = coloring.findIndex((val) => val == null);

		coloring[initialVertex] = 0;

		const frontier = [initialVertex];

		while(frontier.length > 0) {
			const v = frontier.pop() ?? 0;
			const neighbors = Neighborhood(data, v);

			for(const id in neighbors) {
				const u = neighbors[id];

				if(coloring[u] === undefined) {
					if(coloring[v] === 0)
						coloring[u] = 1;
					else
						coloring[u] = 0;

					frontier.push(u);
				}else if(coloring[u] === coloring[v]) {
					return "[]";
				}
			}
		}
	}

	return coloring;
}
export function SpiralColumn(data, index) {
	const res = [];

	for(let i = 0; i < data.length; i++) {
		const elm = data[i].splice(index, 1)[0];

		if(elm != null)
			res.push(elm);
	}

	return res;
}
export function SpiralMatrix(data, progress = []) {
	if(data.length === 0 || data[0].length === 0)
		return progress;

	progress = progress.concat(data.shift());

	if(data.length === 0 || data[0].length === 0)
		return progress;

	progress = progress.concat(SpiralColumn(data, data[0].length - 1));

	if(data.length === 0 || data[0].length === 0)
		return progress;

	progress = progress.concat(data.pop().reverse());

	if(data.length === 0 || data[0].length === 0)
		return progress;

	progress = progress.concat(SpiralColumn(data, 0).reverse());

	if(data.length === 0 || data[0].length === 0)
		return progress;

	return SpiralMatrix(data, progress);
}
export function SubarrayMaxSum(data) {
	let highest = data[0];

	for(let i = 0; i < data.length; i++) {

		for(let j = i; j < data.length; j++) {
			let subset = 0;

			for(let k = i; k <= j; k++)
				subset += data[k];

			if(highest < subset)
				highest = subset;
		}
	}

	return highest;
}