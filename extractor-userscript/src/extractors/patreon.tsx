import { GM_getValue } from "$"
import { Api, BackupApi } from "../utils/api"
import { parallelForEach } from "../utils/parallel"

export type BackupProgressEvent = { 
	currentStep?: string
	filesInProgress?: { name: string, downProgress: number | null, upProgress: number | null }[]
	totalFiles: number
	filesCompleted: number
}

const extractorId = 'patreon'

export async function startPatreonBackupProcess(api: Api, location: URL, onProgress: (progressEvent: BackupProgressEvent) => void, previousBackupLocation: string): Promise<void> {
	const referrer = location.href
	const campaignId = /\/campaign\/(\d+)/.exec(document.querySelector<HTMLImageElement>('main img[src*="/p/campaign"]').src)[1]
	if (!campaignId) {
		console.error("No campaign id found")
		return
	}

	const ytDlFiles = new Set<string>()
	const directDlFiles = new Set<string>()
	const pipeFiles = new Set<string>()
	const urlPathRemaps: Record<string, string> = {}
	const urlsToYtDl = [
		/\/\/stream\.mux\.com\//g,
	]
	const urlsToPipe = [
		/https?\:\/\/.*\.patreon\.com\//g
	]
	const addFile = (f: string, forceYtDl?: boolean) => {
		if (!f || typeof f !== 'string') {
			return f
		}
		if (forceYtDl || urlsToYtDl.some((regex) => f.match(regex))) {
			ytDlFiles.add(f)
			return f
		}
		if (urlsToPipe.some((regex) => f.match(regex))) {
			pipeFiles.add(f)
			return f
		}
		directDlFiles.add(f)
		return f
	}

	const postProcessUrl = (obj: any, attributeName: string) => {
		const url = obj[attributeName]

		// need to remap images from mux because they use the same url for different images but with different query params that we do not store in the final file name
		if (typeof url === 'string' && url.match(/\/\/image\.mux\.com\//g)) {
			const indexOfQuestionMark = url.indexOf('?')
			let newUrl = url.slice(0, indexOfQuestionMark !== -1 ? indexOfQuestionMark : undefined)
			const lastIndexOfDot = newUrl.lastIndexOf('.')
			if (lastIndexOfDot !== -1) {
				// insert before file extension
				newUrl = newUrl.slice(0, lastIndexOfDot) + `_${attributeName}` + newUrl.slice(lastIndexOfDot)
			} else {
				// if no dot, just append
				newUrl = newUrl + `_${attributeName}`
			}
			urlPathRemaps[url] = newUrl
			obj[attributeName] = newUrl
		}

		return url
	}

	onProgress({ currentStep: "Fetching creator data", filesInProgress: [], totalFiles: 0, filesCompleted: 0 })
	let creator = null
	try {
		creator = await fetchCreatorData(campaignId, addFile, postProcessUrl)
		if (!creator) {
			console.error("could not fetch creator data")
			return
		}
	} catch (err) {
		console.error("Error while fetching creator data:", err)
		return
	}
	
	onProgress({ currentStep: "Fetching posts", filesInProgress: [], totalFiles: 0, filesCompleted: 0 })

	const { data, included } = await fetchPosts(creator.data.id, addFile, postProcessUrl, (page) => {
		onProgress({ currentStep: `Fetching posts (page ${page})`, filesInProgress: [], totalFiles: 0, filesCompleted: 0 })
	})

	const backupApi = await api.createBackup({
		previousBackupLocation,
		extractor: extractorId,
		creatorId: creator.data.id,
		creatorVanity: creator.data.attributes.vanity
	})

	let jsonResult = JSON.stringify({
		creator,
		data,
		included
	})

	onProgress({ currentStep: "Uploading metadata", filesInProgress: [], totalFiles: 0, filesCompleted: 0 })
	await Promise.all([
		backupApi.appendFile('data.json', jsonResult),
		backupApi.appendFile('data.json.js', `window.patreonData = ${jsonResult}`)
	])
	onProgress({ currentStep: null, filesInProgress: [], totalFiles: 0, filesCompleted: 0 })

	let completedPipedFiles = 0
	let directPlusYtDlFilesCount = 0
	let completedDirectPlusYtDlFiles = 0
	const totalFiles = () => {
		return directPlusYtDlFilesCount + pipeFiles.size
	}
	const completedFiles = () => {
		return completedDirectPlusYtDlFiles + completedPipedFiles
	}

	await Promise.all([
		await backupApi.downloadWithYtDl([...ytDlFiles.values()], referrer, urlPathRemaps),
		await backupApi.appendFromUrls([...directDlFiles.values()], referrer, urlPathRemaps),
	])

	await Promise.all([
		startPipeFiles(backupApi, pipeFiles, referrer, urlPathRemaps, (event) => {
			completedPipedFiles = event.finishedFiles
			onProgress({ currentStep: "Downloading files", filesInProgress: event.filesInProgress, totalFiles: totalFiles(), filesCompleted: completedFiles() })
		}),
		new Promise<void>(async (resolve) => {
			let httpJobs = 0, ytDlJobs = 0, httpCompletedJobs = 0, ytDlCompletedJobs = 0
			let failsCount = 0
			do {
				try {
					({ http_jobs_pending: httpJobs, yt_dl_jobs_pending: ytDlJobs, http_jobs_completed: httpCompletedJobs, yt_dl_jobs_completed: ytDlCompletedJobs } = await backupApi.getJobs())
					directPlusYtDlFilesCount = httpJobs + ytDlJobs
					completedDirectPlusYtDlFiles = httpCompletedJobs + ytDlCompletedJobs
					failsCount = 0
					onProgress({ currentStep: "Downloading files", totalFiles: totalFiles(), filesCompleted: completedFiles() })
					await new Promise(res => setTimeout(res, 1000))
				} catch (err) {
					failsCount++
					console.error("Error while waiting for yt-dl and direct download jobs to finish", err)
					if (failsCount >= 5) {
						break
					}
					await new Promise(res => setTimeout(res, 5000))
				}
			} while (httpJobs != httpCompletedJobs || ytDlJobs != ytDlCompletedJobs)
			resolve()
		})
	])

	await backupApi.close()
}

async function fetchCreatorData(campaignId: string, addFile: (f: string, forceYtDl?: boolean) => void, postProcessUrlFn: (obj: any, attributeName: string) => string) {
	const creator = await (await fetch(`https://www.patreon.com/api/campaigns/${campaignId}?fields%5Bcampaign%5D=avatar_photo_url,avatar_photo_image_urls,can_migrate_ab,cover_photo_url,cover_photo_url_sizes,current_user_has_entitlement,discord_server_id,summary,creation_name,is_plural,pay_per_name,one_liner,main_video_embed,main_video_url,image_small_url,image_url,thanks_video_url,thanks_embed,thanks_msg,is_monthly,is_nsfw,created_at,primary_theme_color,published_at,pledge_url,pledge_sum,pledge_sum_currency,campaign_pledge_sum,patron_count,post_count,has_public_rss,has_rss,has_spotify_rss,spotify_uri,has_visible_shop,rss_external_auth_link,earnings_visibility,patron_count_visibility,show_earnings,show_patron_count,is_paused,pause_ended_at,launch_review_status,name,url,use_tier_welcome_message,vanity,currency,has_community,tier_highlighting_options,show_getting_started_collection&fields%5Bcampaign-recommendation%5D=recommendation_reason&fields%5Breward%5D=id,title,user_limit,declined_patron_count,description,patron_count,patron_amount_cents,patron_currency,remaining,amount_cents,published,currency,url,discord_role_ids,image_url,welcome_message,welcome_video_embed&fields%5Buser%5D=about,created,discord_id,spotify_id,email,facebook,facebook_id,first_name,full_name,gender,google_id,has_password,hide_pledges,image_url,is_deleted,is_nuked,is_suspended,can_see_nsfw,is_email_verified,last_name,thumb_url,twitch,twitter,url,vanity,youtube,social_connections,current_user_block_status&fields%5Boffer%5D=title,description,ends_at,starts_at,status,days_to_run&fields%5BrewardItem%5D=title,description,offer_id,item_type,is_deleted,is_ended,is_published&fields%5BaccessRule%5D=access_rule_type,amount_cents,post_count&include=post_aggregation,creator.campaign,creator.pledge_to_current_user.null,connected_socials,current_user_pledge.reward.null,current_user_pledge.campaign.null,rewards.items.null,rewards.cadence_options.null,rss_auth_token,access_rules.tier.null,active_offer.rewards.null,scheduled_offer.rewards.null,creator.pledges.campaign.null,reward_items.template,rewards.null,rewards.reward_recommendations,thanks_embed,thanks_msg&json-api-version=1.0&json-api-use-default-includes=false`)).json()

	if (creator.data.attributes) {
		addFile(creator.data.attributes.avatar_photo_url)
		addFile(creator.data.attributes.cover_photo_url)
		addFile(creator.data.attributes.image_small_url)
		addFile(creator.data.attributes.image_url)
		if (creator.data.attributes.cover_photo_url_sizes) {
			for (const size in creator.data.attributes.cover_photo_url_sizes) {
				addFile(creator.data.attributes.cover_photo_url_sizes[size])
			}
		}
		if (creator.data.attributes.summary) {
			try {
				const parser = new DOMParser()
				const htmlDoc = parser.parseFromString(creator.data.attributes.summary, 'text/html')
				const imgs = htmlDoc.querySelectorAll('img')
				for (let i = 0; i < imgs.length; i++) {
					const el = imgs[i]
					if (!el.hasAttribute('src')) {
						return
					}
					const link = el.getAttribute('src')
					addFile(link)
				}
			} catch (err) {
				console.warn(`Error while parsing post content :`, err)
			}
		}
	}

	for (let includedObj of creator.included) {
		if (includedObj.attributes) {
			addFile(includedObj.attributes.image_url)
			addFile(includedObj.attributes.thumb_url)
		}
	}

	return creator
}

async function fetchPosts(creatorId: string, addFile: (f: string, forceYtDl?: boolean) => void, postProcessUrlFn: (obj: any, attributeName: string) => string, onPageStartDownload: (page: number) => void) {
	let nextUrl = `https://www.patreon.com/api/posts?include=campaign%2Caccess_rules%2Caccess_rules.tier.null%2Cattachments_media%2Caudio%2Caudio_preview.null%2Ccustom_thumbnail_media.null%2Cdrop%2Cimages%2Cmedia%2Cnative_video_insights%2Cpoll.choices%2Cpoll.current_user_responses.user%2Cpoll.current_user_responses.choice%2Cpoll.current_user_responses.poll%2Cshows.null%2Cuser%2Cuser_defined_tags%2Cvideo.null%2Ccontent_unlock_options.product_variant.null%2Ccontent_unlock_options.reward.null%2Ccontent_unlock_options.product_variant.collection.null%2Clivestream%2Clivestream.state%2Clivestream.display%2Crss_synced_feed%2Cpost_new_comment_identity%2Cpost_new_comment_identity.avatar%2Cpost_new_comment_identity.identity_badges&fields[campaign]=currency%2Cshow_audio_post_download_links%2Cavatar_photo_url%2Cavatar_photo_image_urls%2Cearnings_visibility%2Cis_nsfw%2Cis_monthly%2Cname%2Curl%2Cpatron_count%2Cprimary_theme_color&fields[post]=change_visibility_at%2Ccomment_count%2Ccommenter_count%2Ccontent%2Ccreated_at%2Ccurrent_user_can_comment%2Ccurrent_user_can_delete%2Ccurrent_user_can_report%2Ccurrent_user_can_view%2Ccurrent_user_comment_disallowed_reason%2Ccurrent_user_has_liked%2Cembed%2Cimage%2Cinsights_last_updated_at%2Cis_paid%2Cis_preview_blurred%2Chas_custom_thumbnail%2Clike_count%2Cmeta_image_url%2Cmin_cents_pledged_to_view%2Cmonetization_ineligibility_reason%2Cpost_file%2Cpost_metadata%2Cpublished_at%2Cpatreon_url%2Cpost_type%2Cpledge_url%2Cpreview_asset_type%2Cthumbnail%2Cthumbnail_url%2Cteaser_text%2Ccontent_teaser_text%2Ccleaned_teaser_text%2Ctitle%2Cupgrade_url%2Curl%2Cwas_posted_by_campaign_owner%2Chas_ti_violation%2Cmoderation_status%2Cpost_level_suspension_removal_date%2Cpls_one_liners_by_category%2Cvideo%2Cvideo_preview%2Cview_count%2Ccontent_unlock_options%2Cis_new_to_current_user%2Cwatch_state&fields[post_tag]=tag_type%2Cvalue&fields[user]=image_url%2Cfull_name%2Curl&fields[access_rule]=access_rule_type%2Camount_cents&fields[livestream]=display%2Cstate&fields[media]=id%2Cimage_urls%2Cdisplay%2Cdownload_url%2Cmetadata%2Cfile_name%2Cstate&fields[native_video_insights]=average_view_duration%2Caverage_view_pct%2Chas_preview%2Cid%2Clast_updated_at%2Cnum_views%2Cpreview_views%2Cvideo_duration&fields[content-unlock-option]=content_unlock_type%2Cis_current_user_eligible%2Creward_benefit_categories&fields[product-variant]=price_cents%2Ccurrency_code%2Ccheckout_url%2Cis_hidden%2Cpublished_at_datetime%2Ccontent_type%2Corders_count%2Caccess_metadata&fields[shows]=id%2Ctitle%2Cdescription%2Cthumbnail&fields[display-identity]=name%2Clink_url&fields[primary-image]=image_icon&fields[identity-badge]=badge_type&filter[campaign_id]=${creatorId}&filter[contains_exclusive_posts]=true&filter[is_draft]=false&filter[include_lives]=true&filter[include_drops]=true&sort=-published_at&json-api-use-default-includes=false&json-api-version=1.0`
	let data = []
	let included = []

	console.log("Downloading posts info")
	const maxPages = GM_getValue('patreonMaxBackupPages', 0)
	let page = 0
	while (nextUrl != null) {
		page++
		if (maxPages > 0 && page > maxPages) {
			break
		}

		onPageStartDownload(page)

		let response = await new Promise<string>((resolve, reject) => {
			let xhr = new XMLHttpRequest()
			xhr.onreadystatechange = () => {
				if (xhr.readyState == 4) {
					if (xhr.status < 400) {
						resolve(xhr.responseText)
					} else {
						reject()
					}
				}
			}
			xhr.open('GET', nextUrl)
			xhr.send()
		})

		let responseObj = JSON.parse(response)
		nextUrl = responseObj.links && responseObj.links.next ? responseObj.links.next : null
		if (responseObj.data) {
			data.push(...responseObj.data)
		}
		if (responseObj.included) {
			for (let i = 0; i < responseObj.included.length; i++) {
				let objId = responseObj.included[i].id
				if (!included.find(i => i.id === objId)) {
					included.push(responseObj.included[i])
				}
			}
		}
	}


	for (let dataObj of data) {
		if (dataObj.attributes) {
			if (dataObj.attributes.meta_image_url) {
				addFile(dataObj.attributes.meta_image_url)
			}
			if (dataObj.attributes.image) {
				for (let prop in dataObj.attributes.image) {
					if (typeof prop === 'string' && prop.endsWith('url')) {
						addFile(dataObj.attributes.image[prop])
						postProcessUrlFn(dataObj.attributes.image, prop)
					}
				}
			}
			if (dataObj.attributes.thumbnail) {
				for (let image in dataObj.attributes.thumbnail) {
					addFile(dataObj.attributes.thumbnail[image])
					postProcessUrlFn(dataObj.attributes.thumbnail, image)
				}
			}
			if (dataObj.attributes.video_preview) {
				if (isLink(dataObj.attributes.video_preview.url)) {
					addFile(dataObj.attributes.video_preview.url)
				}
				if (isLink(dataObj.attributes.video_preview.default_thumbnail?.url)) {
					addFile(dataObj.attributes.video_preview.default_thumbnail.url)
					postProcessUrlFn(dataObj.attributes.video_preview.default_thumbnail, 'url')
				}
				if (isLink(dataObj.attributes.video_preview.storyboard?.vtt_url)) {
					addFile(dataObj.attributes.video_preview.storyboard.vtt_url)
				}
				if (isLink(dataObj.attributes.video_preview.storyboard?.json_url)) {
					addFile(dataObj.attributes.video_preview.storyboard.json_url)
					try {
						const sbResponse = await fetch(dataObj.attributes.video_preview.storyboard.json_url)
						const sbJson = await sbResponse.json()
						if (sbJson && sbJson.url) {
							addFile(sbJson.url)
						}
					} catch (err) {
						console.warn(`Could not fetch storyboard json ${dataObj.attributes.video_preview.storyboard.json_url}:`, err)
					}
				}
			}
			if (dataObj.attributes.embed) {
				if (isLink(dataObj.attributes.embed.html)) {
					addFile(dataObj.attributes.embed.html)
				}
			}
			if (dataObj.attributes.post_file?.url) {
				addFile(dataObj.attributes.post_file.url)
			}
			if (dataObj.attributes.post_file?.default_thumbnail?.url) {
				addFile(dataObj.attributes.post_file.default_thumbnail.url)
				postProcessUrlFn(dataObj.attributes.post_file.default_thumbnail, 'url')
			}
			if (dataObj.attributes.content) {
				try {
					const parser = new DOMParser()
					const htmlDoc = parser.parseFromString(dataObj.attributes.content, 'text/html')
					const imgs = htmlDoc.querySelectorAll('img')
					for (let i = 0; i < imgs.length; i++) {
						const el = imgs[i]
						if (!el.hasAttribute('src')) {
							continue
						}
						const link = el.getAttribute('src')
						addFile(link)
					}
				} catch (err) {
					console.warn(`Error while parsing post content :`, err)
				}
			}
		}
	}

	for (let includedObj of included) {
		if (includedObj.attributes) {
			if (includedObj.type === 'media') {
				if (includedObj.attributes.download_url) {
					addFile(includedObj.attributes.download_url)
				}
				if (includedObj.attributes.image_urls) {
					for (let image in includedObj.attributes.image_urls) {
						addFile(includedObj.attributes.image_urls[image])
						postProcessUrlFn(includedObj.attributes.image_urls, image)
					}
				}
				if (includedObj.attributes.display) {
					if (includedObj.attributes.display.default_thumbnail?.url) {
						addFile(includedObj.attributes.display.default_thumbnail.url)
						postProcessUrlFn(includedObj.attributes.display.default_thumbnail, 'url')
					}
					if (includedObj.attributes.display.url) {
						if (typeof includedObj.attributes.display.duration === 'number') {
							addFile(includedObj.attributes.display.url, true)
						}
					}
				}
			} else if (includedObj.type === 'user') {
				if (includedObj.attributes.image_url) {
					addFile(includedObj.attributes.image_url)
				}
			} else if (includedObj.type === 'campaign') {
				if (includedObj.attributes.avatar_photo_url) {
					addFile(includedObj.attributes.avatar_photo_url)
				}
				if (includedObj.attributes.avatar_photo_image_urls) {
					for (let image in includedObj.attributes.avatar_photo_image_urls) {
						addFile(includedObj.attributes.avatar_photo_image_urls[image])
					}
				}
			} else if (includedObj.type === 'attachment') {
				if (includedObj.attributes.url) {
					addFile(includedObj.attributes.url)
				}
			} else if (includedObj.type === 'goal') {
				if (includedObj.attributes.description) {
					const images = getImagesFromHtmlString(includedObj.attributes.description)
					for (let i = 0; i < images.length; i++) {
						addFile(images[i])
					}
				}
			}
		}
	}

	return {
		data,
		included,
	}
}

function getImagesFromHtmlString(strDoc: string): string[] {
	let images: string[] = []
	try {
		const parser = new DOMParser()
		const htmlDoc = parser.parseFromString(strDoc, 'text/html')
		const imgs = htmlDoc.querySelectorAll('img')
		for (let i = 0; i < imgs.length; i++) {
			const el = imgs[i]
			if (!el.hasAttribute('src')) {
				return
			}
			const link = el.getAttribute('src')
			if (link != null && images.indexOf(link) === -1) {
				images.push(link)
			}
		}
	} catch (err) {
		console.warn(`Error while parsing post content :`, err)
	}
	return images
}

function isLink(str: string): boolean {
	try {
		new URL(str)
		return true
	} catch (e) {
		return false
	}
}

async function startPipeFiles(backupApi: BackupApi, files: Set<string>, referrer: string, urlPathRemaps: Record<string, string>, onProgress: (progressEvent: { filesInProgress: { name: string; downProgress: number; upProgress: number; }[], finishedFiles: number }) => void) {
	const downloadingFiles: { name: string, downProgress: number | null, upProgress: number | null }[] = []
	let finishedFiles = 0
	await parallelForEach(Array.from(files), async (file) => {
		const dlFile = { name: file, downProgress: null, upProgress: null }
		downloadingFiles.push(dlFile)
		onProgress({ filesInProgress: downloadingFiles, finishedFiles })
		try {
			await backupApi.fetchPipe(file, (downloaded, total) => {
				dlFile.downProgress = downloaded / total
				onProgress({ filesInProgress: downloadingFiles, finishedFiles })
			}, referrer, urlPathRemaps)
		} finally {
			downloadingFiles.splice(downloadingFiles.indexOf(dlFile), 1)
			finishedFiles++
			onProgress({ filesInProgress: downloadingFiles, finishedFiles })
		}
	}, 6)
}