import { useRef, useState } from "preact/hooks"
import { Lightbox } from "./Lightbox"

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
	const [lightboxParams, setLightboxParams] = useState<{ initialIndex: number, isOpen: boolean }>({ initialIndex: 0, isOpen: false })
	const openLightbox = (index: number) => {
		setLightboxParams(() => ({ initialIndex: index, isOpen: true }))
	}
	return (
		<div class="flex flex-col gap-[8px]">
			{ lightboxParams.isOpen && (
				<Lightbox
					images={images.map(img => img.original)}
					initialIndex={lightboxParams.initialIndex}
					onClose={() => {
						setLightboxParams((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) }
			<button class="w-full relative flex justify-around cursor-pointer" onClick={() => openLightbox(0)}>
				<div class="absolute inset-0 bg-cover bg-center bg-(--small-bg)" style={{ 'background-image': 'url(' + (images[0].default_blurred_small || images[0].thumbnail) + ')' }}>
					<div class="absolute inset-0 backdrop-blur-lg bg-(--background-subtle-color)"></div>
				</div>
				<img class="w-full max-h-[50vh] object-contain z-10" src={images[0].default} />
			</button>
			{ images.length > 1 && <div class="flex gap-[8px] overflow-x-auto">
				{ images.slice(1).map(image => (
					<button class="cursor-pointer" onClick={() => openLightbox(images.indexOf(image))}>
						<img class="w-auto h-24 max-w-none" src={image.thumbnail} />
					</button>
				)) }
			</div> }
		</div>
	)
}