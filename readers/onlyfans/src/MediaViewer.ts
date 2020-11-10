import { autoinject } from 'aurelia-framework'
import { DialogController } from 'aurelia-dialog'
import { PostMedia } from 'app'

@autoinject
export class MediaViewer {
    constructor (public controller: DialogController) { }
    media: PostMedia[]
    mediaToShow: number

    activate (model: { media: PostMedia[], mediaToShow: number }) {
        this.mediaToShow = model.mediaToShow
        this.media = model.media
    }

    previousMedia() {
        if (this.mediaToShow > 0) {
            this.mediaToShow--
        }
    }
    
    nextMedia() {
        if (this.mediaToShow < this.media.length - 1) {
            this.mediaToShow++
        }
    }
}
