export type CoverData = {
	coverUrl: string | null
	avatarUrl: string | null
}

export function Cover({ coverUrl, avatarUrl }: CoverData) {
	return (
		<div class="flex items-end mb-8 sm:mb-10 md:mb-14 bg-cover bg-center aspect-4/1" style={{ 'background-image': 'url(' + coverUrl + ')' }}>
			<div class="rounded-xl relative w-20 sm:w-24 md:w-32 h-20 sm:h-24 md:h-32 mx-auto translate-y-[30%] after:rounded-[inherit] after:inset-0 after:absolute after:inset-shadow-[0_0_0_1px_var(--border-muted-color)]" style={{ 'background-image': 'url(' + avatarUrl + ')' }}>
				<img class="w-full h-full object-cover block rounded-[inherit]" src={avatarUrl} />
			</div>
		</div>
	)
}