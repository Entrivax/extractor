export async function parallelForEach<T>(array: T[], callback: (item: T) => Promise<void>, parallelCount: number) {
	const stack = array.slice()
	const runningPromises: Promise<void>[] = []
	for (let i = 0; i < parallelCount && stack.length > 0; i++) {
		const item = stack.shift()
		runningPromises.push(selfRemovePromise(callback(item)))
	}

	while (stack.length > 0) {
		await Promise.race(runningPromises)
		const item = stack.shift()
		runningPromises.push(selfRemovePromise(callback(item)))
	}

	await Promise.all(runningPromises)

	function selfRemovePromise(promise) {
		const self = new Promise<void>(resolve => {
			promise.catch(() => {}).then(() => {
				let indexOf = runningPromises.indexOf(self)
				if (indexOf !== -1) {
					runningPromises.splice(indexOf, 1)
				}
				resolve()
			})
		})
		return self
	}
}