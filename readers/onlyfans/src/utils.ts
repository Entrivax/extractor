export function cleanLink(link) {
    if (typeof link !== "string") {
        return null
    }
    return link.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')
}
