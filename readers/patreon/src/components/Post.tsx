import { Embed } from "./Embed";
import { ImageItem } from "./ImageItem";
import { Poll } from "./Poll";
import { VideoItem } from "./VideoItem";

export type PostData = {
	id: string;
	attributes: {
		title: string;
		content: string;
		published_at: string;
		post_type: "image_file" | "video_external_file" | "video_embed" | "text" | "poll" | "link";
		comment_count: number;
		like_count: number;
		embed?: {
			url: string;
			provider: string;
			provider_url: string;
			subject: string;
			description: string;
			html: string;
			width?: number;
			height?: number;
		};
		poll?: {
			id: string;
			attributes: {
				question_text: string;
				closes_at: string;
				created_at: string;
				num_responses: number;
				choices: {
					id: string;
					text: string;
					num_responses: number;
					text_content: string;
					isSelected: boolean;
				}[];
			};
		};
		image?: ImageData
		images?: ImageData[];
		videoExternal?: VideoExternalData
		attachments?: AttachmentData[]
	}
}

export type AttachmentData = {
	id: string;
	attributes: {
		file_name: string;
		download_url: string;
	}
}

export type ImageData = {
	id: string;
	attributes: {
		image_urls: {
			default: string;
			original: string;
			thumbnail: string;
			default_blurred_small: string;
		};
		download_url: string;
		file_name: string;
	};
	metadata: {
		dimensions: {
			h: number;
			w: number;
		}
	};
	type: string;
}

export type VideoExternalData = {
	id: string;
	attributes: {
		display: {
			duration: number;
			url: string;
			default_thumbnail: {
				url: string;
			}
		}
	};
	metadata: {
		dimensions: {
			h: number;
			w: number;
		}
	};
	type: string;
}

export function Post({ post }: { post: PostData }) {
	return (
		<div class="md:rounded-[8px] w-full flex flex-col overflow-hidden bg-(--container-background-color)">
			{ (() => {
				switch (post.attributes.post_type) {
					case 'link':
						return (
							<Embed data={{
								...post.attributes.embed,
								imageUrl: post.attributes.image ? post.attributes.image.attributes.image_urls.default : '',
							}}/>
						)
					case 'image_file':
						return (
							<ImageItem images={post.attributes.images.map(img => ({ ...img.attributes.image_urls, download_url: img.attributes.download_url }))} />
						)
					case 'video_external_file':
						return (
							<VideoItem videoUrl={post.attributes.videoExternal?.attributes.display.url} posterUrl={post.attributes.videoExternal?.attributes.display.default_thumbnail?.url} />
						)
				}
			})() }
			<div class="p-[16px]">
				<h2 class="text-2xl font-bold">{ post.attributes.title }</h2>
				<div class="text-(--regular-muted-text-color) text-sm mt-1.5">{ post.attributes.published_at }</div>

				{ post.attributes.content && <div class="my-5" dangerouslySetInnerHTML={{ __html: post.attributes.content }}></div> }

				{ post.attributes.post_type === 'poll' && <Poll poll={{
					...post.attributes.poll.attributes,
				}} />}

				{ post.attributes.attachments?.length > 0 && <div class="flex flex-col mt-4 gap-1">
					{ post.attributes.attachments.map(attachment => (
						<a href={attachment.attributes.download_url} class="flex gap-2 items-center w-fit text-(--action-color) hover:text-(--action-hover-color) focus-visible:text-(--action-hover-color) active:text-(--action-pressed-color)" key={`${post.id}-${attachment.id}`} download>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-icon lucide-file w-4 h-4"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
							<span class="underline">{attachment.attributes.file_name}</span>
						</a>
					))}
				</div> }

				<div class="flex mt-5 text-(--regular-muted-text-color) text-sm gap-4">
					<div class="flex items-center gap-2"> 
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-icon lucide-message-circle w-6 h-6"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
						<div>{post.attributes.comment_count}</div>
					</div>
					<div class="flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart-icon lucide-heart w-6 h-6"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
						<div>{post.attributes.like_count}</div>
					</div>
				</div>
			</div>
		</div>
	)
}