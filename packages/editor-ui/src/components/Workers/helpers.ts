export function averageWorkerLoadFromLoads(loads: number[]): number {
	return loads.reduce((prev, curr) => prev + curr, 0) / loads.length;
}

export function averageWorkerLoadFromLoadsAsString(loads: number[]): string {
	return averageWorkerLoadFromLoads(loads).toFixed(2);
}
