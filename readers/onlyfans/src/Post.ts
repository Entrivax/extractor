import { bindable } from 'aurelia-framework'
import { User } from 'app'
import tippy from 'tippy.js';

export class Post {
    @bindable
    post: any

    @bindable
    creator: User

    @bindable
    users: User[]

    contentElement: HTMLDivElement
    private _attached: boolean = false
    private _tooltips: any[]

    postChanged() {
        if (this._attached) {
            this._updateTooltips()
        }
    }

    attached() {
        this._updateTooltips()
        this._attached = true
    }

    private _updateTooltips() {
        this.contentElement.innerHTML = this.post.content
        const links = this.contentElement.querySelectorAll('a')
        const tooltips = []
        for (let i = 0; i < links.length; i++) {
            const link = links[i]
            if (!link.hasAttribute('href')) {
                continue
            }
            const url = link.getAttribute('href')
            const parsedUrl = /https:\/\/onlyfans.com\/(.+)/.exec(url)
            if (parsedUrl == null) {
                continue
            }
            const username = parsedUrl[1]
            const user = this.users?.find(u => u.username === username)
            if (user == null) {
                continue
            }
            const tippyInstance = tippy(link, {
                allowHTML: true,
                appendTo: document.body,
                delay: [0, 250],
                offset: [0, 2],
                arrow: false,
                interactive: true,
                placement: 'bottom-start',
                maxWidth: 'none',
                content: `
                <div class="rounded-md" style="width: 350px">
                    <div class="cover-image rounded-t-md bg-cover bg-center h-20 relative" ${user.coverUrl ? `style="background-image: url(${user.coverUrl})"` : ''}>
                        <div class="bg-semi-transparent rounded-t-md absolute inset-0"></div>
                    </div>
                    <div class="flex items-center -mt-12 p-4 relative">
                        <div class="rounded-full w-16 h-16 mr-4 border-2 bg-cover bg-center avatar" ${user.avatarUrl ? `style="background-image: url(${user.avatarUrl})"` : ''}></div>
                        <div class="relative flex-grow">
                            <div class="absolute text-white text-lg font-medium w-full max-w-full truncate" style="bottom: 100%">${user.name}</div>
                            <div class="absolute w-full max-w-full truncate" style="top: 100%">@${user.username}</div>
                        </div>
                    </div>
                </div>
                `
            })
            tooltips.push(tippyInstance)
        }
        if (tooltips.length > 0) {
            this._tooltips = tooltips
        }
    }

    detached() {
        this.destroyTooltips()
    }

    private destroyTooltips() {
        if (this._tooltips) {
            this._tooltips.forEach(t => t.destroy())
            this._tooltips = null
        }
    }
}
