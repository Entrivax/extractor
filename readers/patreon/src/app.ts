import { cleanLink, parseHtmlAndCleanLinks } from "utils"
import * as moment from "moment";

export class App {
    posts = []
    noData: boolean
    coverUrl: string
    avatarUrl: string
    bannerData: {
        creatorName: string,
        creationName: string
    }

    activate() {
        const data = (window as any).patreonData
        if (data === undefined) {
            this.noData = true
            console.error('window.patreonData is undefined')
            return this
        }
        try {
            const posts = data.data;
            const metadatas = data.included;

            const metadatasMap = {}
            metadatas.forEach(m => {
                metadatasMap[m.id] = {
                    id: m.id,
                    type: m.type,
                    attributes: {
                        ...m.attributes,
                    },
                    relationships: {
                        ...m.relationships
                    }
                }
            })
            for (let key of Object.keys(metadatasMap)) {
                const m = metadatasMap[key]
                if (m.type === 'user') {
                    metadatasMap[key].attributes.image_url = cleanLink(metadatasMap[key].attributes.image_url)
                } else if (m.type === 'media') {
                    metadatasMap[key].attributes.image_urls = {
                        default: cleanLink(metadatasMap[key].attributes.image_urls.default),
                        original: cleanLink(metadatasMap[key].attributes.image_urls.original),
                        thumbnail: cleanLink(metadatasMap[key].attributes.image_urls.thumbnail),
                    }
                } else if (m.type === 'poll') {
                    const userResponses = metadatasMap[key].relationships.current_user_responses.data.map(resp => metadatasMap[resp.id])
                    metadatasMap[key].attributes.choices = metadatasMap[key].relationships.choices.data.map(c => {
                        const choice = metadatasMap[c.id]
                        return {
                            id: c.id,
                            attributes: {
                                ...choice.attributes,
                                isSelected: !!userResponses?.find(r => r.relationships.choice.data.id === c.id)
                            }
                        }
                    })
                }
            }

            this.posts = posts.map((p) => {
                return {
                    id: p.id,
                    attributes: {
                        content: p.attributes.content ? parseHtmlAndCleanLinks(p.attributes.content) : undefined,
                        image: p.relationships.images.data.length > 0 ? metadatasMap[p.relationships.images.data[0].id] : undefined,
                        images: p.attributes.post_metadata && p.attributes.post_metadata.image_order
                            ? p.attributes.post_metadata.image_order.map(io => metadatasMap[io])
                            : p.relationships.images.data.map(i => metadatasMap[i.id]),
                        post_type: p.attributes.post_type,
                        published_at: moment(p.attributes.published_at).format('lll'),
                        title: p.attributes.title,
                        comment_count: p.attributes.comment_count,
                        like_count: p.attributes.like_count,
                        embed: p.attributes.embed,
                        poll: p.attributes.post_type === 'poll' ? metadatasMap[p.relationships.poll.data.id] : undefined
                    }
                }
            })

            this.coverUrl = cleanLink(data.creator.data.attributes.cover_photo_url)
            this.avatarUrl = cleanLink(data.creator.data.attributes.avatar_photo_url)
            this.bannerData = {
                creatorName: data.creator.data.attributes.name,
                creationName: data.creator.data.attributes.creation_name
            }

            document.title = `${data.creator.data.attributes.name} - Patreon Backup`
        } catch (e) {
            console.error(e)
            this.noData = true
        }
    }
}

export type BannerData = {
    creatorName: string,
    creationName: string
}
