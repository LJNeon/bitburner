export enum Stage {
	Preparing,
	Running,
	Stopping
}
export enum Task {
	Weak1 = "Weak1",
	Weak2 = "Weak2",
	Grow = "Grow",
	Hack = "Hack"
}
export function TaskRecord<T>(value: T): Record<Task, T> {
	return {
		[Task.Weak1]: value,
		[Task.Weak2]: value,
		[Task.Grow]: value,
		[Task.Hack]: value
	};
}
export enum Color {
	Default = "\u001b[38;5;250m",
	Info = "\u001b[38;5;116m",
	Success = "\u001b[38;5;78m",
	Warn = "\u001b[38;5;185m",
	Fail = "\u001b[38;5;203m"
}