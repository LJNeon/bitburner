export const STAGE = {
	PREPARING: Symbol("STAGE.PREPARING"),
	RUNNING: Symbol("STAGE.RUNNING"),
	STOPPING: Symbol("STAGE.STOPPING")
};
export const TASKS = {
	WEAK_1: Symbol("TASKS.WEAK_1"),
	WEAK_2: Symbol("TASKS.WEAK_2"),
	GROW: Symbol("TASKS.GROW"),
	HACK: Symbol("TASKS.HACK"),
	get LIST() {
		return Object.values(this).slice(0, -1);
	}
};