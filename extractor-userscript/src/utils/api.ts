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

	async createBackup(info: {
		extractor: string,
		creatorId: string,
		creatorVanity: string,
		previousBackupLocation: string
	}) {
		const form = new FormData()
		if (info.previousBackupLocation) {
			form.append('previous_backup_location', info.previousBackupLocation)
		}
		form.append('extractor', info.extractor)
		form.append('creator_id', info.creatorId)
		form.append('creator_vanity', info.creatorVanity)
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

	async getJobs() {
		const req = await makeRequest({
			method: 'GET',
			url: `${this.apiUrl}/backup/${this.backupId}/jobs`,
			responseType: 'json',
		})
		return req.response as {
			http_jobs_pending: number
			yt_dl_jobs_pending: number
			http_jobs_completed: number
			yt_dl_jobs_completed: number
		}
	}

	async fetchPipe(url: string, onDownProgress: (downloaded: number, total: number) => void, referer: string, urlPathRemaps: Record<string, string>) {
		let attempt = 0

		const copyResult = await makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/copy-file?path=${encodeURIComponent(this.toLocalPath(urlPathRemaps[url] || url))}`,
			responseType: 'json',
			headers: {
				'Referer': referer,
			},
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

	async appendFromUrls(urls: string[], referer: string, urlPathRemaps: Record<string, string>) {
		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/queue-urls`,
			responseType: 'json',
			headers: {
				'Referer': referer,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ files: urls.map(url => ({ path: this.toLocalPath(urlPathRemaps[url] || url), url })) }),
		})
	}

	async downloadWithYtDl(urls: string[], referer: string, urlPathRemaps: Record<string, string>) {
		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/queue-yt-dl`,
			responseType: 'json',
			headers: {
				'Referer': referer,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ files: urls.map(url => ({ path: this.toLocalPath(urlPathRemaps[url] || url), url })) }),
		})
	}

	close() {
		return makeRequest({
			method: 'POST',
			url: `${this.apiUrl}/backup/${this.backupId}/close`,
			responseType: 'json',
		})
	}
}
