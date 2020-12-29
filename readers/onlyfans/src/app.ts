import { PLATFORM } from 'aurelia-pal';
import { Router, RouterConfiguration } from "aurelia-router"
import * as moment from 'moment'
import { cleanLink } from 'utils'
import { userFromUserData } from './utils'

export class App {
    router: Router
    noData: boolean
    coverData: CoverData
    creatorCardInfo: CreatorCardInfo

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
        
        document.title = `${data.creator.name} - OnlyFans Backup`
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
