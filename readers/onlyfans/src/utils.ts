import * as moment from "moment"

export function cleanLink(link) {
    if (typeof link !== "string") {
        return null
    }
    return link.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')
}

export function userFromUserData(user: any): User {
    return {
        id: user.id,
        avatarUrl: cleanLink(user.avatar),
        name: user.name,
        username: user.username,
        isVerified: user.isVerified,
        coverUrl: cleanLink(user.header)
    }
}

export function postFromPostData(users: User[], post: any): PostData {
    return {
        id: post.id,
        content: processPostContent(post.text),
        responseType: post.responseType,
        mediaType: post.mediaType,
        media: post.media.map((media) => {
            return {
                id: media.id,
                type: media.type,
                preview: cleanLink(media.preview),
                full: cleanLink(media.full),
                source: { ...media.source }
            }
        }),
        linkedPosts: post.linkedPosts?.map(p => postFromPostData(users, p)),
        linkedUsers: post.linkedUsers?.map(u => users.find(user => user.id === u.id)).filter(u => u != null),
        price: post.price,
        canViewMedia: post.canViewMedia,
        preview: [ ...post.preview ],
        hasVoting: post.hasVoting,
        voting: { ...post.voting },
        postedAt: moment(post.postedAt).format('lll'),
        commentsCount: post.commentsCount,
        favoritesCount: post.favoritesCount,
        tipsAmount: +(/\d+\.?\d*/g.exec(post.tipsAmount)?.[0]) > 0 ? post.tipsAmount : null,
    }
}

export function processPostContent(content: string) {
    if (content == null) {
        return content
    }
    try {
        const parser = new DOMParser()
        const htmlDoc = parser.parseFromString(content, 'text/html')
        const links = htmlDoc.querySelectorAll('a')
        for (let i = 0; i < links.length; i++) {
            const el = links[i]
            if (!el.hasAttribute('href')) {
                return
            }
            el.setAttribute('target', '_blank')
            const link = el.getAttribute('href')
            if (link.startsWith('/')) {
                el.setAttribute('href', `https://onlyfans.com${link}`)
            }
        }
        return htmlDoc.body.innerHTML
    } catch (err) {
        return content
    }
}
