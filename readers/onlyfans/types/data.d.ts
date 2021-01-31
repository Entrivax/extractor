declare type CoverData = {
    name: string,
    isVerified: boolean,
    postsCount: number,
    favoritedCount: number,
    coverUrl: string,
}

declare type User = {
    id: number,
    avatarUrl: string,
    name: string,
    username: string,
    isVerified: boolean,
    coverUrl: string,
    isMe: boolean,
}

declare type CreatorCardInfo = {
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

declare type PostData = {
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

declare type PostMedia = {
    id: number,
    type: 'photo' | 'video',
    preview: string,
    full: string,
    source: any
}

declare type HighlightData = {
    id: number,
    title: string,
    cover: string,
    stories: StoryData[]
}

declare type StoryData = {
    id: number
    createdAt: string
    media: [{
        id: number
        type: 'photo' | 'video'
        files: {
            source: {
                url: string
                width: number
                height: number
                duration: number
                sources: { [size: string]: string | null }
            }
            squarePreview: {
                url: string
                width: number
                height: number
                sources: { [size: string]: string | null }
            }
            thumb: {
                url: string
                width: number
                height: number
            }
            preview: {
                url: string
                width: number
                height: number
            }
        }
    }]
}

declare type HeaderData = {
    name: string,
}

declare type MessageData = {
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

declare type Messages = {
    fromUser: User,
    messages: MessageData[],
    showDate: boolean
}
