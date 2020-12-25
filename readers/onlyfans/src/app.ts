import { PLATFORM } from 'aurelia-pal';
import { Router, RouterConfiguration } from "aurelia-router"
import { userFromUserData, storyFromStoryData, highlightFromHighlightData } from './utils'
import { cleanLink } from "utils"
import * as moment from "moment";
import * as _ from "lodash";
import { DialogService } from 'aurelia-dialog'
import { autoinject } from 'aurelia-framework'
import { MediaViewer } from 'MediaViewer'

@autoinject
export class App {
    router: Router
    noData: boolean
    coverData: CoverData
    creatorCardInfo: CreatorCardInfo
    highlights: HighlightData[]
    windowWidth: number

    constructor(private dialogService: DialogService) { }

    configureRouter(config: RouterConfiguration, router: Router): void {
        this.router = router;
        config.map([
            { route: '', name: 'feed', moduleId: PLATFORM.moduleName('Feed') },
            { route: 'archived', name: 'archived', moduleId: PLATFORM.moduleName('ArchivedFeed') },
        ]);
    }

    get displayPostsTab() {
        return (window as any).onlyFansData?.data?.length > 0 || this.router.currentInstruction?.config.name === 'feed'
    }

    get displayArchivedPostsTab() {
        return (window as any).onlyFansData?.archivedPosts?.length > 0 || this.router.currentInstruction?.config.name === 'archived'
    }

    get displayTabs() {
        return +this.displayPostsTab + +this.displayArchivedPostsTab > 1
    }

    async attached() {
        this.windowWidth = window.innerWidth
        const eventListener = () => {
            this.windowWidth = window.innerWidth
        }
        window.addEventListener('resize', () => {
            eventListener()
        })

        const data = (window as any).onlyFansData
        if (data === undefined) {
            this.noData = true
            console.error('window.onlyFansData is undefined')
            return this
        }

        this.coverData = {
            name: data.creator.name,
            isVerified: data.creator.isVerified,
            postsCount: data.creator.postsCount,
            favoritedCount: data.creator.favoritedCount,
            coverUrl: cleanLink(data.creator.header)
        }

        this.creatorCardInfo = {
            ...userFromUserData(data.creator),
            lastSeen: data.creator.lastSeen ? moment(data.creator.lastSeen).format('lll') : null,
            about: data.creator.about,
            currentSubscribePrice: data.creator.currentSubscribePrice,
            location: data.creator.location,
            website: data.creator.website,
            wishlist: data.creator.wishlist,
        }

        const stories: StoryData[] = data.stories?.map(storyFromStoryData)
        const highlights: HighlightData[] = stories && stories.length > 0 ? [{
            cover: stories[stories.length - 1].media[0].files.squarePreview.url,
            id: -1,
            stories: stories,
            title: 'Stories'
        }] : []

        data.highlights?.map(highlightFromHighlightData).forEach(h => highlights.push(h))

        this.highlights = highlights.length > 0 ? highlights : null

        document.title = `${data.creator.name} - OnlyFans Backup`
    }

    openHighlight(highlight: HighlightData) {
        this.dialogService.open({
            viewModel: MediaViewer,
            lock: false,
            centerHorizontalOnly: true,
            model: {
                media: highlight.stories.map<PostMedia>((s) => ({
                    id: s.id,
                    type: s.media[0].type,
                    preview: s.media[0].files.preview.url,
                    full: s.media[0].files.source.url,
                    source: s.media[0].files.source
                })),
                mediaToShow: 0
            }
        })
    }

    switchColorMode() {
        let isCurrentDarkMode = document.body.classList.contains('dark-mode')
        if (isCurrentDarkMode) {
            document.body.classList.remove('dark-mode')
        } else {
            document.body.classList.add('dark-mode')
        }
        localStorage.setItem('OnlyFans-backup-color-mode', !isCurrentDarkMode ? 'dark' : 'light')
    }
}
