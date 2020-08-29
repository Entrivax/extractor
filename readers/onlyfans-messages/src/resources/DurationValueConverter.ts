export class DurationValueConverter {
    toView (duration: number): string {
        const minutes = Math.trunc(duration / 60)
        const seconds = duration % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
}
