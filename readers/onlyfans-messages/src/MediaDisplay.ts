import { bindable } from 'aurelia-framework'
import { Message } from './app'

export class MediaDisplay {
    @bindable
    message: Message

    media: any[]
    imagesCount: number
    videoDuration: number

    messageChanged() {
        this.media = this.message.media.filter(media => media.canView)
        this.imagesCount = this.message.media.filter(media => media.type === 'photo').length
        this.videoDuration = this.message.media.filter(media => media.type === 'video').length
    }
}
