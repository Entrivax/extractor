import { Signal,  useSignal, useSignalEffect } from "@preact/signals"
import { createContext } from "preact"
import { useEffect } from "preact/hooks"

const themes = new Set(['light', 'dark'])

export const Theme = createContext<{ currentTheme: Signal<string | null> }>(null);

export function setupThemeSwitcher() {
    const currentTheme = useSignal<string | null>(localStorage.getItem('patreonbackup-theme'))
    useEffect(() => {
        const abortController = new AbortController()

        window.addEventListener('storage', (event) => {
            if (event.storageArea === localStorage && event.key === 'patreonbackup-theme' && currentTheme.peek() !== event.newValue) {
                currentTheme.value = event.newValue
            }
        }, { signal: abortController.signal })

        currentTheme.value = localStorage.getItem('patreonbackup-theme')

        return () => {
            abortController.abort()
        }
    })

    useSignalEffect(() => {
        if (currentTheme.value !== localStorage.getItem('patreonbackup-theme')) {
            if (currentTheme.value == null) {
                localStorage.removeItem('patreonbackup-theme')
            } else {
                localStorage.setItem('patreonbackup-theme', currentTheme.value ?? '')
            }
        }
        applyTheme(currentTheme.value)
    })

    function applyTheme(theme: string | null) {
        if (!themes.has(theme)) {
            document.documentElement.classList.remove(...themes)
        } else {
            document.documentElement.classList.remove(...themes)
            document.documentElement.classList.add(theme)
        }
    }

    return {
        currentTheme
    }
}