import { GM_xmlhttpRequest, GmResponseEvent, GmResponseType } from "$"

function makeRequest<T extends GmResponseType>(options: { method: string, url: string, responseType: T, headers?: Record<string, string>, body?: BodyInit }) {
	return new Promise<GmResponseEvent<T, any>>((resolve, reject) => {
		GM_xmlhttpRequest({
			method: options.method,
			url: options.url,
			responseType: options.responseType,
			data: options.body,
			headers: options.headers,
			onload: (response) => {
				if (response.status >= 200 && response.status < 300) {
					resolve(response)
				} else {
					reject(new Error(`HTTP error! status: ${response.status}`))
				}
			},
			onerror: (err) => {
				reject(err)
			},
		})
	})
}

export class Api {
	constructor(private apiUrl: string) {}

	async createBackup(previousBackupLocation: string) {
		const form = new FormData()
		if (previousBackupLocation) {
			form.append('previous_backup_location', previousBackupLocation)
		}
		const req = await makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/create-backup`,
			responseType: 'json',
			body: form,
		})

		const backupId = req.response.key

		return new BackupApi(this.apiUrl, backupId)
	}
}

export class BackupApi {
	constructor(private apiUrl: string, private backupId: string) {}

	private toLocalPath(url: string) {
		return decodeURIComponent(url.replace(/^https?:\/\//, '')
			.replaceAll('%3F', '')
			.replaceAll('%3A', '')
			.replaceAll('%23', '')
			.replaceAll('%7C', '')
			.replaceAll('%22', '')
			.replaceAll('%3C', '')
			.replaceAll('%3E', '')
			.replaceAll('%5C', '/')
			.replace(/\?(.*)/, '')
		)
	}

	async fetchPipe(url: string, onDownProgress: (downloaded: number, total: number) => void, referrer: string) {
		let attempt = 0

		const copyResult = await makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/copy-file?path=${encodeURIComponent(this.toLocalPath(url))}`,
			responseType: 'json',
		})
		if (copyResult.response.success === 'ok') {
			return
		}

		let res: ArrayBuffer = null
		const maxAttempts = 5
		while (attempt < maxAttempts) {
			try {
				res = await new Promise<ArrayBuffer>((resolve, reject) => {
					let xhr = new XMLHttpRequest()
					xhr.responseType = "arraybuffer"
					xhr.onreadystatechange = () => {
						if (xhr.readyState == 4) {
							if (xhr.status < 400) {
								resolve(xhr.response)
							} else {
								reject(xhr)
							}
						}
					}
					xhr.onprogress = (ev) => {
						if (ev.lengthComputable) {
							onDownProgress(ev.loaded, ev.total)
						} else {
							onDownProgress(ev.loaded, 0)
						}
					}
					xhr.open('GET', url)
					xhr.send()
				})
				break
			} catch (err) {
				console.error(err)
			}
			attempt++
			await new Promise(res => setTimeout(res, 3000 * attempt))
		}
		if (attempt === maxAttempts) {
			throw new Error(`Failed to fetch ${url} after ${maxAttempts} attempts`)
		}

		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/file?path=${encodeURIComponent(this.toLocalPath(url))}`,
			responseType: 'json',
			body: res,
		})
	}

	async appendFile(path: string, content: BodyInit) {
		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/file?path=${encodeURIComponent(path)}`,
			responseType: 'json',
			body: content,
		})
	}

	async appendFromUrl(url: string, referrer: string) {
		const form = new FormData()
		form.append('url', url)
		form.append('path', this.toLocalPath(url))
		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/append-from-url`,
			responseType: 'json',
			headers: {
				'Referrer': referrer,
			},
			body: form,
		})
	}

	async downloadWithYtDl(url: string, mediaId: string, referrer: string): Promise<string> {
		const form = new FormData()
		form.append('url', url)
		form.append('mediaId', mediaId)
		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/download-with-yt-dl`,
			responseType: 'json',
			headers: {
				'Referrer': referrer,
			},
			body: form,
		}).then(res => res.response.file_path)
	}

	close() {
		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/close`,
			responseType: 'json',
		})
	}
}
