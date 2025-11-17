export function VideoItem({ videoUrl, posterUrl }: { videoUrl: string, posterUrl?: string }) {
	if (!videoUrl) {
		return null
	}
	return (
		<div>
			<video controls onError={(e) => { console.log('Video error', e) }} class="w-full h-auto" poster={posterUrl}>
				<source src={videoUrl} type="video/mp4" />
			</video>
		</div>
	)
}