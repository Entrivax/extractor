export function VideoItem({ videoUrl }: { videoUrl: string }) {
	if (!videoUrl) {
		return null
	}
	return (
		<div>
			<video controls onError={(e) => { console.log('Video error', e) }} class="w-full h-auto">
				<source src={videoUrl} type="video/mp4" />
			</video>
		</div>
	)
}