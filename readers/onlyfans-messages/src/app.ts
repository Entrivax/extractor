import { cleanLink } from "utils"
import * as moment from "moment"
import * as _ from "lodash"

export class App {
    messages: Messages[] = []
    noData: boolean
    headerData: HeaderData
    users: { [name: string]: User }

    switchColorMode () {
        let isCurrentDarkMode = document.body.classList.contains('dark-mode')
        if (isCurrentDarkMode) {
            document.body.classList.remove('dark-mode')
        } else {
            document.body.classList.add('dark-mode')
        }
        localStorage.setItem('OnlyFans-backup-color-mode', !isCurrentDarkMode ? 'dark' : 'light')
    }

    async activate () {
        const data = (window as any).onlyFansMessagesData
        if (data === undefined) {
            this.noData = true
            console.error('window.onlyFansMessagesData is undefined')
            return this
        }
        try {
            this.users = _.mapValues(data.users, (user) => {
                return {
                    avatarUrl: cleanLink(user.avatar),
                    name: user.name,
                    username: user.username,
                    isVerified: user.isVerified,
                    isMe: user.id === data.myId,
                } as User
            })

            const messages: Message[] = _.reverse((data.data as any[]).map((m) => ({
                id: m.id,
                content: m.text,
                media: m.media.map((media) => {
                    return {
                        id: media.id,
                        canView: media.canView,
                        type: media.type,
                        preview: cleanLink(media.preview),
                        full: cleanLink(media.full),
                        source: {
                            source: cleanLink(media.source.source)
                        }
                    }
                }),
                canPurchase: m.canPurchase,
                isFree: m.isFree,
                user: this.users[m.fromUser.id],
                price: m.price,
                isOpened: m.isOpened,
                preview: m.preview ? [...m.preview] : undefined,
                createdAt: moment(m.createdAt),
                wasEdited: m.createdAt !== m.changedAt
            })))

            let lastMessagesGroup: Messages = null
            for (let i = 0; i < messages.length; i++) {
                const lastMessageDate = lastMessagesGroup?.messages[lastMessagesGroup.messages.length - 1].createdAt
                if (lastMessagesGroup == null
                    || lastMessagesGroup.fromUser !== messages[i].user
                    || messages[i].createdAt.diff(lastMessageDate, 'minutes', true) > 5) {
                    if (lastMessagesGroup) {
                        this.messages.push(lastMessagesGroup)
                    }
                    lastMessagesGroup = {
                        fromUser: messages[i].user,
                        messages: [],
                        showDate: lastMessagesGroup == null || messages[i].createdAt.diff(lastMessagesGroup.messages[0].createdAt, 'days') >= 1 || lastMessagesGroup.messages[0].createdAt.weekday() !== messages[i].createdAt.weekday()
                    }
                }
                lastMessagesGroup.messages.push(messages[i])
            }
            if (lastMessagesGroup != null) {
                this.messages.push(lastMessagesGroup)
            }

            this.headerData = {
                name: _.keys(this.users)
                    .filter(u => !this.users[u].isMe)
                    .map(u => this.users[u].name)
                    .reduce((a, b) => `${a}, ${b}`)
            }

            document.title = `${this.headerData.name} - OnlyFans messages Backup`
        } catch (e) {
            console.error(e)
            this.noData = true
        }
    }
}

export type HeaderData = {
    name: string,
}

export type User = {
    avatarUrl: string,
    name: string,
    username: string,
    isVerified: boolean,
    isMe: boolean,
}

export type Message = {
    id: number,
    canPurchase: boolean,
    isFree: boolean,
    content: string,
    media: any,
    user: User,
    price: number,
    preview: any[],
    createdAt: moment.Moment,
    wasEdited: boolean,
}

export type Messages = {
    fromUser: User,
    messages: Message[],
    showDate: boolean
}
