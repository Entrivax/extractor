export class FromValueConverter {
    toView (array: any[] | null, start: number) {
        return array ? array.slice(start) : undefined
    }
}
