import { cleanLink } from "utils"
import * as moment from "moment";

export class App {
    posts = []
    noData: boolean
    coverData: CoverData
    creator: Creator
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
            const posts = data.data;

            this.posts = posts.map((p) => {
                return {
                    id: p.id,
                    content: p.text,
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

            this.coverData = {
                name: data.creator.name,
                isVerified: data.creator.isVerified,
                postsCount: data.creator.postsCount,
                favoritedCount: data.creator.favoritedCount,
                coverUrl: cleanLink(data.creator.header)
            }
            this.creator = {
                avatarUrl: cleanLink(data.creator.avatar),
                name: data.creator.name,
                username: data.creator.username,
                isVerified: data.creator.isVerified,
            }
            this.creatorCardInfo = {
                ...this.creator,
                lastSeen: data.creator.lastSeen ? moment(data.creator.lastSeen).format('lll') : null,
                about: data.creator.about,
                currentSubscribePrice: data.creator.currentSubscribePrice,
            }

            document.title = `${data.creator.name} - OnlyFans Backup`
        } catch (e) {
            console.error(e)
            this.noData = true
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

export type Creator = {
    avatarUrl: string,
    name: string,
    username: string,
    isVerified: boolean,
}

export type CreatorCardInfo = {
    avatarUrl: string,
    name: string,
    username: string,
    isVerified: boolean,
    lastSeen: string | null,
    about: string,
    currentSubscribePrice: number,
}
