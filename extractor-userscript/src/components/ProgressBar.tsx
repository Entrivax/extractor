export function ProgressBar({ primaryProgress, secondaryProgress }: { primaryProgress: number | null; secondaryProgress: number | null }) {
	return (
		<div class="progress-bar" style={{ '--primary-progress': primaryProgress ?? 0, '--secondary-progress': secondaryProgress ?? 0 } as preact.CSSProperties}>
			{ primaryProgress != null || secondaryProgress != null ? (
				<>
					{ primaryProgress != null && <div class="primary-progress"></div> }
					{ secondaryProgress != null && <div class="secondary-progress"></div> }
				</>
			) : (
				<div class="indeterminate-progress"></div>
			)}
		</div>
	)
}