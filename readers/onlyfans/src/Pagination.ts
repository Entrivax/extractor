import { bindable } from 'aurelia-framework'

export class Pagination {
    @bindable
    page: number
    @bindable
    totalPages: number
    @bindable
    navigationPages: number

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

    private updatePages() {
        this.pagesBackward = Math.max(Math.min(this.page, this.navigationPages || 2), 0)
        this.pagesForward = Math.max(Math.min(this.totalPages - this.page - 1, this.navigationPages || 2), 0)
    }
}
