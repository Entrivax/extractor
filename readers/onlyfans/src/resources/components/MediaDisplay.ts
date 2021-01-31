import { PLATFORM } from 'aurelia-pal';
import { bindable, autoinject } from 'aurelia-framework'
import { DialogService } from 'aurelia-dialog'
import { MediaViewer } from './MediaViewer'
PLATFORM.moduleName('./MediaViewer')

@autoinject
export class MediaDisplay {
    @bindable
    message: MessageData
    @bindable
    post: PostData
    @bindable
    creator: User
    @bindable
    isNested: boolean

    media: PostMedia[]
    imagesCount: number
    videoDuration: number
    canView: boolean
    price: number

    constructor(private dialogService: DialogService) {}

    postChanged() {
        this.canView = this.post.canViewMedia
        this.price = this.post.price
        this.media = this.post.canViewMedia ? this.post.media : this.post.media.filter(media => this.post.preview.indexOf(media.id) !== -1)
        this.imagesCount = this.post.media.filter(media => media.type === 'photo' && this.post.preview.indexOf(media.id) === -1).length
        this.videoDuration = this.post.media.filter(media => media.type === 'video' && this.post.preview.indexOf(media.id) === -1).reduce((a, b) => a + b.source.duration, 0)
    }

    messageChanged() {
        this.price = this.message.price
        this.media = this.message.media.filter(media => media.canView)
        this.canView = !this.message.media.find(media => !media.canView)
        this.imagesCount = this.message.media.filter(media => media.type === 'photo').length
        this.videoDuration = this.message.media.filter(media => media.type === 'video').length
    }

    openMedia(mediaIndex: number, event?: MouseEvent) {
        if (event) {
            event.preventDefault()
        }

        this.dialogService.open({
            viewModel: MediaViewer,
            lock: false,
            centerHorizontalOnly: true,
            model: {
                media: this.media,
                mediaToShow: mediaIndex
            }
        })

        return false
    }
}
