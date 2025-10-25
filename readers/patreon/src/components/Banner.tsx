export type BannerData = {
	creatorName: string
	creationName: string
}


export function Banner({ data }: { data: BannerData }) {
	return (
		data && (<div class="flex flex-col content-center">
			<div class="text-center px-[8px]">
				<div class="text-3xl font-bold">{ data.creatorName }</div>
				<div class="text-(--regular-muted-text-color)">{ data.creationName }</div>
			</div>
		</div>)
	);
}
