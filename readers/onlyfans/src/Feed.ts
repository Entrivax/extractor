import { cleanLink } from "utils"
import * as moment from "moment";
import { observable, autoinject } from 'aurelia-framework'
import { activationStrategy, Router } from "aurelia-router"

@autoinject
export class Feed {
    posts: PostData[] = []
    noData: boolean
    coverData: CoverData
    creator: User
    users: User[]
    creatorCardInfo: CreatorCardInfo
    private _elementsPerPage: number
    page: number

    get pagesCount() {
        return this.elementsPerPage && this.posts ? Math.ceil(this.posts.length / this.elementsPerPage) : 0
    }

    get elementsPerPage(): number {
        return this._elementsPerPage
    }
    set elementsPerPage(value: number) {
        const oldValue = this._elementsPerPage
        let newValue = value
        if (newValue === null) {
            this.router.navigateToRoute('feed', { limit: 'all' })
        } else {
            const firstElementNum = (oldValue || 0) * (this.page || 0)
            newValue ||= 50
            const newFirstElementPage = Math.floor(firstElementNum / (newValue))
            this.router.navigateToRoute('feed', { page: (newFirstElementPage + 1).toString(), limit: value.toString() })
        }
    }

    constructor(public router: Router) {}

    switchColorMode() {
        let isCurrentDarkMode = document.body.classList.contains('dark-mode')
        if (isCurrentDarkMode) {
            document.body.classList.remove('dark-mode')
        } else {
            document.body.classList.add('dark-mode')
        }
        localStorage.setItem('OnlyFans-backup-color-mode', !isCurrentDarkMode ? 'dark' : 'light')
    }

    determineActivationStrategy() {
        return activationStrategy.invokeLifecycle
    }

    async attached() {
        const data = (window as any).onlyFansData
        if (data === undefined) {
            this.noData = true
            console.error('window.onlyFansData is undefined')
            return this
        }
        try {
            const posts: any[] = data.data

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

            this.posts = posts.map<PostData>((p) => postFromPostData(this.users, p))
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

        function postFromPostData(users: User[], post: any): PostData {
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

    async activate(params: { page?: string, limit?: string }) {
        const page = +params.page
        const elementsPerPageMap = {
            "50": 50,
            "100": 100,
            "200": 200,
            "500": 500,
            "1000": 1000,
            "all": null
        }
        this._elementsPerPage = (() => { const elements = elementsPerPageMap[params.limit]; return elements === undefined ? 50 : elements })()
        this.page = Math.max(!isNaN(page) ? page - 1 : 0, 0)
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
    media: PostMedia[],
    linkedPosts: PostData[],
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

export type PostMedia = {
    id: number,
    type: 'photo' | 'video',
    preview: string,
    full: string,
    source: any
}