export type ImageUrls = {
	download_url: string;
	original: string;
	default: string;
	thumbnail: string;
	default_blurred_small: string;
}

export function ImageItem({ images }: { images: ImageUrls[] }) {
	if (!images || images.length === 0) {
		return null
	}
	return (
		<div class="flex flex-col gap-[8px]">
			<a class="w-full relative flex justify-around" href={images[0].download_url || images[0].original} target="_blank">
				<div class="absolute inset-0 bg-cover bg-center bg-(--small-bg)" style={{ 'background-image': 'url(' + (images[0].default_blurred_small || images[0].thumbnail) + ')' }}>
					<div class="absolute inset-0 backdrop-blur-lg bg-(--background-subtle-color)"></div>
				</div>
				<img class="w-full max-h-[50vh] object-contain z-10" src={images[0].default} />
			</a>
			{ images.length > 1 && <div class="flex gap-[8px] overflow-x-auto">
				{ images.slice(1).map(image => (
					<a href={image.download_url || image.original} target="_blank">
						<img class="w-auto h-24 max-w-none" src={image.thumbnail} />
					</a>
				)) }
			</div> }
		</div>
	)
}