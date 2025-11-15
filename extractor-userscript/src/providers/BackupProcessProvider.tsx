import { createContext } from "preact"
import { useContext, useMemo, useState } from "preact/compat"
import { useApi } from "./ApiProvider"
import { useLocation } from "../utils/location"
import { Api } from "../utils/api"
import { BackupProgressEvent, startPatreonBackupProcess } from "../extractors/patreon"

export type BackupProcessApi = {
	name: string
	startBackupProcess: (previousBackupLocation: string) => void
}

export type BackupProcess = {
	currentStep?: string
	filesInProgress: { name: string, downProgress: number | null, upProgress: number | null }[]
	totalFiles: number
	filesCompleted: number
}

export type BackupProcessCtx = {
	backupProcessApi?: BackupProcessApi
	currentProcess: BackupProcess | null
}

const BackupProcessContext = createContext<BackupProcessCtx>(null)

export function BackupProcessProvider({ children }: { children: preact.ComponentChildren }) {
	const api = useApi()
	const { location } = useLocation()
	const [currentProcess, setCurrentProcess] = useState<BackupProcess | null>(null)

	const backupProcessApi = useMemo<BackupProcessApi | undefined>(() => {
		if (location.href.match(/https:\/\/(www\.)?patreon\.com\/cw?\/[a-zA-Z0-9_-]+\/.*/)) {
			return {
				name: "Patreon",
				startBackupProcess: async (previousBackupLocation: string) => {
					await runBackup(startPatreonBackupProcess, previousBackupLocation)
				}
			}
		}

		return undefined

		async function runBackup(backupFunc: (api: Api, location: URL, onProgress: (progressEvent: BackupProgressEvent) => void, previousBackupLocation: string) => Promise<void>, previousBackupLocation: string) {
			if (currentProcess) {
				return
			}
			let process: BackupProcess = {
				filesInProgress: [],
				totalFiles: 0,
				filesCompleted: 0
			}
			setCurrentProcess(process)
			try {
				await backupFunc(api, location, (progressEvent) => setCurrentProcess((prev) => {
					return { ...prev, ...progressEvent }
				}), previousBackupLocation)
			} catch (e) {
				console.error("Backup process failed", e)
			}
			setCurrentProcess(null)
		}
	}, [api, location])

	return (
		<BackupProcessContext.Provider value={{ backupProcessApi, currentProcess: currentProcess }}>
			{children}
		</BackupProcessContext.Provider>
	)
}

export function useBackupProcess() {
	const ctx = useContext(BackupProcessContext)
	if (!ctx) {
		throw new Error("useBackupProcess must be used within a BackupProcessProvider")
	}
	return ctx
}