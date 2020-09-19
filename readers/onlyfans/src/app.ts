import { cleanLink } from "utils"
import * as moment from "moment";

export class App {
    posts: PostData[] = []
    noData: boolean
    coverData: CoverData
    creator: User
    users: User[]
    creatorCardInfo: CreatorCardInfo

    switchColorMode() {
        let isCurrentDarkMode = document.body.classList.contains('dark-mode')
        if (isCurrentDarkMode) {
            document.body.classList.remove('dark-mode')
        } else {
            document.body.classList.add('dark-mode')
        }
        localStorage.setItem('OnlyFans-backup-color-mode', !isCurrentDarkMode ? 'dark' : 'light')
    }

    async activate() {
        const data = (window as any).onlyFansData
        if (data === undefined) {
            this.noData = true
            console.error('window.onlyFansData is undefined')
            return this
        }
        try {
            const posts: any[] = data.data;

            this.coverData = {
                name: data.creator.name,
                isVerified: data.creator.isVerified,
                postsCount: data.creator.postsCount,
                favoritedCount: data.creator.favoritedCount,
                coverUrl: cleanLink(data.creator.header)
            }
            this.creator = userFromUserData(data.creator)

            const users = [this.creator]
            if (data.users) {
                const userIds = Object.keys(data.users)
                for (let i = 0; i < userIds.length; i++) {
                    const user = data.users[userIds[i]]
                    users.push(userFromUserData(user))
                }
            }
            this.users = users

            this.posts = posts.map<PostData>((p) => {
                return {
                    id: p.id,
                    content: processPostContent(p.text),
                    responseType: p.responseType,
                    mediaType: p.mediaType,
                    media: p.media.map((media) => {
                        return {
                            id: media.id,
                            type: media.type,
                            preview: cleanLink(media.preview),
                            full: cleanLink(media.full),
                            source: { ...media.source }
                        }
                    }),
                    linkedUsers: p.linkedUsers?.map(u => this.users.find(user => user.id === u.id)).filter(u => u != null),
                    price: p.price,
                    canViewMedia: p.canViewMedia,
                    preview: [ ...p.preview ],
                    hasVoting: p.hasVoting,
                    voting: { ...p.voting },
                    postedAt: moment(p.postedAt).format('lll'),
                    commentsCount: p.commentsCount,
                    favoritesCount: p.favoritesCount,
                    tipsAmount: +(/\d+\.?\d*/g.exec(p.tipsAmount)?.[0]) > 0 ? p.tipsAmount : null,
                }
            })
            this.creatorCardInfo = {
                ...this.creator,
                lastSeen: data.creator.lastSeen ? moment(data.creator.lastSeen).format('lll') : null,
                about: data.creator.about,
                currentSubscribePrice: data.creator.currentSubscribePrice,
                location: data.creator.location,
                website: data.creator.website,
                wishlist: data.creator.wishlist,
            }

            document.title = `${data.creator.name} - OnlyFans Backup`
        } catch (e) {
            console.error(e)
            this.noData = true
        }

        function userFromUserData(user: any): User {
            return {
                id: user.id,
                avatarUrl: cleanLink(user.avatar),
                name: user.name,
                username: user.username,
                isVerified: user.isVerified,
                coverUrl: cleanLink(user.header)
            }
        }

        function processPostContent(content: string) {
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
    }
}

export type CoverData = {
    name: string,
    isVerified: boolean,
    postsCount: number,
    favoritedCount: number,
    coverUrl: string,
}

export type User = {
    id: number,
    avatarUrl: string,
    name: string,
    username: string,
    isVerified: boolean,
    coverUrl: string,
}

export type CreatorCardInfo = {
    avatarUrl: string,
    name: string,
    username: string,
    isVerified: boolean,
    lastSeen: string | null,
    about: string,
    currentSubscribePrice: number,
    location?: string,
    website?: string,
    wishlist?: string,
}

export type PostData = {
    id: number,
    content: string,
    responseType: 'post',
    mediaType: 'photo' | 'video',
    media: {
        id: number,
        type: 'photo' | 'video',
        preview: string,
        full: string,
        source: any
    },
    linkedUsers: User[],
    price: number | null,
    canViewMedia: boolean,
    preview: number[],
    hasVoting: boolean,
    voting: any,
    postedAt: string,
    commentsCount: number
    favoritesCount: number
    tipsAmount: number
}
