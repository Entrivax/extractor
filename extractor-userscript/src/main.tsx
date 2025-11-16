import { render } from 'preact'

import style from './style.css?inline'
import { BackupProcessProvider, useBackupProcess } from './providers/BackupProcessProvider'
import { ApiProvider } from './providers/ApiProvider'
import { BackupProgression } from './components/BackupProgression'
import { GM_getValue } from '$'

export function App() {
	const backupProcess = useBackupProcess()
	if (!backupProcess.currentProcess && !backupProcess.backupProcessApi) {
		return null
	}
	return (
		<div class="extractor-window">
			<BackupProgression backupProcess={backupProcess.currentProcess} />
			{ !backupProcess.currentProcess && <div>
				{ backupProcess.backupProcessApi && <button onClick={() => {backupProcess.backupProcessApi.startBackupProcess(window.prompt("Enter previous backup location (optional)", ""))}}>{`Start ${backupProcess.backupProcessApi?.name} backup`}</button> }
			</div> }
		</div>
	)
}

render((
	<ApiProvider apiUrl={GM_getValue("apiUrl", "https://localhost:7766")}>
		<BackupProcessProvider>
			<App />
		</BackupProcessProvider>
	</ApiProvider>
), (() => {
	const div = document.createElement('div')
	const shadow = div.attachShadow({ mode: 'open' })
	const sheet = new CSSStyleSheet()
	sheet.replaceSync(style.toString())
	shadow.adoptedStyleSheets = [sheet]
	document.body.appendChild(div)
	return shadow
})())
