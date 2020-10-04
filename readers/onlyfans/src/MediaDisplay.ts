import { bindable } from 'aurelia-framework'
import { User } from 'app'

export class MediaDisplay {
    @bindable
    post: any
    @bindable
    creator: User
    @bindable
    isNested: boolean

    media: any[]
    imagesCount: number
    videoDuration: number

    postChanged() {
        this.media = this.post.canViewMedia ? this.post.media : this.post.media.filter(media => this.post.preview.indexOf(media.id) !== -1)
        this.imagesCount = this.post.media.filter(media => media.type === 'photo' && this.post.preview.indexOf(media.id) === -1).length
        this.videoDuration = this.post.media.filter(media => media.type === 'video' && this.post.preview.indexOf(media.id) === -1).reduce((a, b) => a + b.source.duration, 0)
    }
}
