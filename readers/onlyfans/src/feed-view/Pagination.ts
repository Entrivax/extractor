import { bindable } from 'aurelia-framework'
import { Router } from 'aurelia-router'

export class Pagination {
    @bindable
    page: number
    @bindable
    totalPages: number
    @bindable
    navigationPages: number
    @bindable
    router: Router
    @bindable
    route: string

    pagesBackward: number
    pagesForward: number

    pageChanged() {
        this.updatePages()
    }
    totalPagesChanged() {
        this.updatePages()
    }
    navigationPagesChanged() {
        this.updatePages()
    }

    changePage(page: number) {
        this.router.navigateToRoute(this.route, { ...this.router.currentInstruction.queryParams, page: (page + 1).toString() })
    }

    private updatePages() {
        this.pagesBackward = Math.max(Math.min(this.page, this.navigationPages || 2), 0)
        this.pagesForward = Math.max(Math.min(this.totalPages - this.page - 1, this.navigationPages || 2), 0)
    }
}
