import { createRef } from 'preact';
import { useLinks } from '../../../utils/strings.js';
import { Banner } from '../../components/Banner.js';
import { Cover } from '../../components/Cover.js';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Posts } from '../../components/Posts.js';
import { PostData } from '../../components/Post.js';
import { useSearchParams } from 'react-router-dom';

export function Home() {
	const [searchParams] = useSearchParams()
	const { cleanLink, parseHtmlAndCleanLinks } = useLinks((searchParams.get('base') || null) as string | null)
	const [data, setData] = useState({
		patreonData: (window as any).patreonData,
		error: null as string | null
	})
	useEffect(() => {
		const script = document.createElement('script')
		script.src = `${searchParams.get('base') || '.'}/data.json.js`
		document.head.append(script)
		let timeoutId = null
		let removed = false
		script.onload = () => {
			if (removed) {
				return
			}
			timeoutId = setTimeout(() => {
				if (typeof (window as any).patreonData === 'object') {
					setData({
						patreonData: (window as any).patreonData,
						error: null
					})
				} else {
					setData({
						patreonData: (window as any).patreonData,
						error: 'Error: Data is not an object.'
					})
				}
			})
		}
		script.onerror = () => {
			setData({
				patreonData: null,
				error: ''
			})
		}
		return () => {
			script.remove()
			removed = true
			if (timeoutId != null) {
				clearTimeout(timeoutId)
			}
		}
	}, [searchParams.get('base')])

	useEffect(() => {
		const theme = data?.patreonData?.creator.data.attributes.primary_theme_color
		if (!theme) {
			document.documentElement.style.removeProperty('--primary-theme-color')
			return
		}
		document.documentElement.style.setProperty('--primary-theme-color', data?.patreonData?.creator.data.attributes.primary_theme_color)
	}, [data?.patreonData])

	const posts = useMemo(() => {
		if (!data?.patreonData) {
			return [];
		}
		const posts = data?.patreonData.data;
		const metadatas = data?.patreonData.included;
		const metadatasMap = {}
		metadatas.forEach(m => {
			metadatasMap[m.id] = {
				id: m.id,
				type: m.type,
				attributes: {
					...m.attributes,
				},
				relationships: {
					...m.relationships
				}
			}
		})
		for (let key of Object.keys(metadatasMap)) {
			const m = metadatasMap[key]
			if (m.type === 'user') {
				metadatasMap[key].attributes.image_url = cleanLink(metadatasMap[key].attributes.image_url)
			} else if (m.type === 'media') {
				if (metadatasMap[key].attributes.image_urls) {
					for (let prop in metadatasMap[key].attributes.image_urls) {
						if (typeof prop === 'string') {
							metadatasMap[key].attributes.image_urls[prop] = cleanLink(metadatasMap[key].attributes.image_urls[prop])
						}
					}
				}
				if (metadatasMap[key].attributes.download_url) {
					metadatasMap[key].attributes.download_url = cleanLink(metadatasMap[key].attributes.download_url)
				}
				if (metadatasMap[key].attributes.display?.url) {
					metadatasMap[key].attributes.display.url = cleanLink(metadatasMap[key].attributes.display.url)
				}
				if (metadatasMap[key].attributes.display?.default_thumbnail?.url) {
					metadatasMap[key].attributes.display.default_thumbnail.url = cleanLink(metadatasMap[key].attributes.display.default_thumbnail.url)
				}
			} else if (m.type === 'poll') {
				const userResponses = metadatasMap[key].relationships.current_user_responses.data.map(resp => metadatasMap[resp.id])
				metadatasMap[key].attributes.closes_at = formatDate(metadatasMap[key].attributes.closes_at)
				metadatasMap[key].attributes.created_at = formatDate(metadatasMap[key].attributes.created_at)
				metadatasMap[key].attributes.choices = metadatasMap[key].relationships.choices.data.map(c => {
					const choice = metadatasMap[c.id]
					return {
						id: c.id,
						...choice.attributes,
						isSelected: !!userResponses?.find(r => r.relationships.choice.data.id === c.id)
					}
				})
			}
		}

		return posts.map((p) => {
			return {
				id: p.id,
				attributes: {
					content: p.attributes.content ? parseHtmlAndCleanLinks(p.attributes.content) : undefined,
					image: p.relationships.images.data.length > 0 ? metadatasMap[p.relationships.images.data[0].id] : undefined,
					images: p.attributes.post_metadata && p.attributes.post_metadata.image_order
						? p.attributes.post_metadata.image_order.map(io => metadatasMap[io])
						: p.relationships.images.data.map(i => metadatasMap[i.id]),
					post_type: p.attributes.post_type,
					published_at: formatDate(p.attributes.published_at),
					title: p.attributes.title,
					comment_count: p.attributes.comment_count,
					like_count: p.attributes.like_count,
					embed: p.attributes.embed,
					poll: p.attributes.post_type === 'poll' ? metadatasMap[p.relationships.poll.data.id] : undefined,
					videoExternal: p.attributes.post_type === 'video_external_file' ? metadatasMap[p.relationships.video.data.id] : undefined,
					attachments: p.relationships.attachments_media?.data?.map(d => metadatasMap[d.id]) ?? undefined,
				}
			} satisfies PostData
		})
	}, [data])

	if (data?.error != null) {
		return (
			<div class="h-full w-full flex flex-col justify-center items-center">
				<h1 class="text-2xl font-bold mb-2">Unable to read data from data.json.js file</h1>
				<div class="text-(--regular-muted-text-color)">Check if the file is present in the same directory, else, check the console for any error.</div>
				<div class="whitespace-pre-wrap text-(--regular-muted-text-color)">{data.error}</div>
			</div>
		)
	}

	if (!data?.patreonData) {
		return null
	}

	const coverUrl = cleanLink(data?.patreonData.creator.data.attributes.cover_photo_url)
	const avatarUrl = cleanLink(data?.patreonData.creator.data.attributes.avatar_photo_url)
	return (
		<div>
			<Cover coverUrl={coverUrl} avatarUrl={avatarUrl} />
			<div class="mb-[16px]">
				<Banner data={{
					creatorName: data?.patreonData.creator.data.attributes.name,
					creationName: data?.patreonData.creator.data.attributes.creation_name
				}} />
			</div>
			<div class="pb-[24px] 2xl:w-240 xl:w-200 lg:w-180 md:w-170 w-full mx-auto">
				<Posts posts={posts} />
			</div>
		</div>
	);
}

function formatDate(date: string) {
	if (!date) {
		return ''
	}
	return new Intl.DateTimeFormat("en-US", {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hour12: false,
	}).format(new Date(date))
}