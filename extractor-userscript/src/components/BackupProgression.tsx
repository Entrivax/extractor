import { BackupProcess } from "../providers/BackupProcessProvider"
import { ProgressBar } from "./ProgressBar"

export function BackupProgression({ backupProcess }: { backupProcess: BackupProcess | null }) {
	if (!backupProcess) {
		return null
	}

	return (
		<div class="backup-progression">
			{ backupProcess.currentStep && <div class="status">
				<span class="status-icon">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity-icon lucide-activity"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
				</span>
				<span>{ backupProcess.currentStep }</span>
			</div> }
			<div>Downloaded files: { backupProcess.filesCompleted } / { backupProcess.totalFiles }</div>
			<div class="files-in-progress">
				{ backupProcess.filesInProgress.map(file => (
					<div class="file-entry">
						<span class="file-name" title={ file.name }>{ file.name }: </span>
						<ProgressBar primaryProgress={file.downProgress} secondaryProgress={file.upProgress} />
					</div>
				)) }
			</div>
		</div>
	)
}