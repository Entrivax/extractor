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
