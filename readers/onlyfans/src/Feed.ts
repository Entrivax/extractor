import { postFromPostData, userFromUserData } from "utils"
import { autoinject } from 'aurelia-framework'
import { activationStrategy, Router } from "aurelia-router"

@autoinject
export class Feed {
    posts: PostData[] = []
    noData: boolean
    creator: User
    users: User[]
    private _elementsPerPage: number
    page: number

    get pagesCount() {
        return this.elementsPerPage && this.posts ? Math.ceil(this.posts.length / this.elementsPerPage) : 0
    }

    get elementsPerPage(): number {
        return this._elementsPerPage
    }
    set elementsPerPage(value: number) {
        const oldValue = this._elementsPerPage
        let newValue = value
        if (newValue === null) {
            this.router.navigateToRoute('feed', { limit: 'all' })
        } else {
            const firstElementNum = (oldValue || 0) * (this.page || 0)
            newValue ||= 50
            const newFirstElementPage = Math.floor(firstElementNum / (newValue))
            this.router.navigateToRoute('feed', { page: (newFirstElementPage + 1).toString(), limit: value.toString() })
        }
    }

    constructor(public router: Router) { }

    determineActivationStrategy() {
        return activationStrategy.invokeLifecycle
    }

    async attached() {
        const data = (window as any).onlyFansData
        try {
            const posts: any[] = data.data

            this.creator = userFromUserData(data.creator)

            const users = [this.creator]
            if (data.users) {
                const userIds = Object.keys(data.users)
                for (let i = 0; i < userIds.length; i++) {
                    const user = data.users[userIds[i]]
                    users.push(userFromUserData(user))
                }
            }
            this.users = users

            this.posts = posts.map<PostData>((p) => postFromPostData(this.users, p))
        } catch (e) {
            console.error(e)
            this.noData = true
        }
    }

    async activate(params: { page?: string, limit?: string }) {
        const page = +params.page
        const elementsPerPageMap = {
            "50": 50,
            "100": 100,
            "200": 200,
            "500": 500,
            "1000": 1000,
            "all": null
        }
        this._elementsPerPage = (() => { const elements = elementsPerPageMap[params.limit]; return elements === undefined ? 50 : elements })()
        this.page = Math.max(!isNaN(page) ? page - 1 : 0, 0)
    }
}
