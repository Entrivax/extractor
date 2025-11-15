import { useEffect, useMemo, useState } from "preact/hooks";

export function useLocation() {
	const [location, setLocation] = useState<string>(window.location.href)
	const loc = useMemo(() => new URL(location), [location])

	useEffect(() => {
		const handleLocationChange = () => {
			setLocation(window.location.href)
		};

		const observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				if (location != document.location.href) {
					handleLocationChange()
				}
			});
		});

		const abortController = new AbortController()
		const signal = abortController.signal

		window.addEventListener('popstate', handleLocationChange, { signal })
		window.addEventListener('pushstate', handleLocationChange, { signal })
		window.addEventListener('replacestate', handleLocationChange, { signal })
		observer.observe(document.body, {
			childList: true,
			subtree: true
		})
		signal.addEventListener('abort', () => {
			observer.disconnect()
		})

		return () => {
			abortController.abort()
		}
	}, [])

	return { location: loc }
}