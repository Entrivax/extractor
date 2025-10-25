export function cleanLink(link) {
    if (typeof link !== "string") {
        return null
    }
    return link.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')
}

export function parseHtmlAndCleanLinks(html) {
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
