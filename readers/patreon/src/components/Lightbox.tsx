import { createPortal } from "preact/compat"
import { useEffect, useState } from "preact/hooks"

export function Lightbox({ images, initialIndex, onClose }: { images: string[]; initialIndex: number; onClose: () => void }) {
    const [currentIndex, setCurrentIndex] = useState<number>(initialIndex ?? 0)

    useEffect(() => {
        const abortController = new AbortController()
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault()
                event.stopPropagation()
                setCurrentIndex((prev) => {
                    prev--
                    if (prev < 0) {
                        prev = images.length - 1
                    }
                    return prev
                })
            } else if (event.key === "ArrowRight") {
                event.preventDefault()
                event.stopPropagation()
                setCurrentIndex((prev) => {
                    prev++
                    if (prev >= images.length) {
                        prev = 0
                    }
                    return prev
                })
            } else if (event.key === "Escape") {
                event.preventDefault()
                event.stopPropagation()
                onClose()
            }
        }

        document.addEventListener("keydown", handleKeyDown, { signal: abortController.signal })
        return () => {
            abortController.abort()
        }
    }, [])

    return (
        createPortal(
            <div class="fixed z-50 inset-0">
                <div class="absolute inset-0 bg-black/50" onClick={onClose}></div>
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img class="max-h-full max-w-full pointer-events-auto" src={images[currentIndex]} alt={`Image ${currentIndex + 1}`} />
                </div>
                <button class="absolute top-4 right-4 text-white p-2 cursor-pointer" onClick={onClose}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x w-4 h-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            </div>,
            document.body
        )
    )
}