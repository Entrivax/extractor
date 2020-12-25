export class PagingValueConverter {
    toView (array: any[] | null, page: number, countPerPage: number) {
        return array
            ? (
                countPerPage != null
                ? array.slice(page * countPerPage, Math.min(array.length, (page + 1) * countPerPage))
                : array
            )
            : undefined
    }
}
