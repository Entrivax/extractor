import { PLATFORM } from 'aurelia-pal';
import { bindable, autoinject } from 'aurelia-framework'
import { PostData, PostMedia, User } from 'Feed'
import { DialogService } from 'aurelia-dialog'
import { MediaViewer } from './MediaViewer'
PLATFORM.moduleName('./MediaViewer')

@autoinject
export class MediaDisplay {
    @bindable
    post: PostData
    @bindable
    creator: User
    @bindable
    isNested: boolean

    media: PostMedia[]
    imagesCount: number
    videoDuration: number

    constructor(private dialogService: DialogService) {}

    postChanged() {
        this.media = this.post.canViewMedia ? this.post.media : this.post.media.filter(media => this.post.preview.indexOf(media.id) !== -1)
        this.imagesCount = this.post.media.filter(media => media.type === 'photo' && this.post.preview.indexOf(media.id) === -1).length
        this.videoDuration = this.post.media.filter(media => media.type === 'video' && this.post.preview.indexOf(media.id) === -1).reduce((a, b) => a + b.source.duration, 0)
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
