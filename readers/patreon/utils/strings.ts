export function useLinks(base: string | null): { cleanLink: (link: string | null) => string | null, getMediaLink: (mediaId: number | null) => string | null, parseHtmlAndCleanLinks: (html: string | null) => string | null } {
	const cleanLink = (link: string | null): string | null => {
		if (typeof link !== "string") {
			return null
		}
		return link.replace(/^https?:\/\//, (base != null ? base : '.') + '/')
			.replaceAll('%3F', '')
			.replaceAll('%3A', '')
			.replaceAll('%23', '')
			.replaceAll('%7C', '')
			.replaceAll('%22', '')
			.replaceAll('%3C', '')
			.replaceAll('%3E', '')
			.replaceAll('%5C', '/')
			.replace(/\?(.*)/, '')
	}
	return {
		cleanLink,
		getMediaLink(mediaId: number | null): string | null {
			if (!mediaId) {
				return null
			}
			return `${base != null ? base : '.'}/media/${mediaId}.mp4`
		},
		parseHtmlAndCleanLinks(html: string | null): string | null {
			if (html == null) {
				return html
			}
			var parser = new DOMParser();
			var htmlDoc = parser.parseFromString(html, 'text/html');
			htmlDoc.querySelectorAll('img').forEach((el) => {
				if (el.hasAttribute('src')) {
					el.setAttribute('src', cleanLink(el.getAttribute('src')))
				}
			})
			return htmlDoc.documentElement.querySelector('body').innerHTML
		}
	}
}
