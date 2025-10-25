import { useContext } from "preact/hooks"
import { Theme } from "../../utils/theme-switcher"
import { useComputed } from "@preact/signals"

export function ThemeSwitch() {
    const { currentTheme } = useContext(Theme)
    const toggleTheme = () => {
        const theme = currentTheme.peek()
        switch (theme) {
            case 'light':
                currentTheme.value = 'dark'
                break
            case 'dark':
                currentTheme.value = null
                break
            default:
                currentTheme.value = 'light'
                break
        }
    }

    const icon = () => {
        switch (currentTheme.value) {
            case 'light':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun-icon lucide-sun w-6 h-6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                )
            case 'dark':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon-icon lucide-moon w-6 h-6"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
                )
            default:
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun-moon-icon lucide-sun-moon w-6 h-6"><path d="M12 2v2"/><path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/><path d="M16 12a4 4 0 0 0-4-4"/><path d="m19 5-1.256 1.256"/><path d="M20 12h2"/></svg>
                )
        }
    }

    const title = useComputed(() => {
        let currentThemeName = 'System'
        switch (currentTheme.value) {
            case 'light':
                currentThemeName = 'Light'
                break
            case 'dark':
                currentThemeName = 'Dark'
                break
        }
        return `Change theme (current: ${currentThemeName})`
    })

    return (
        <button
            class="p-1 rounded-md bg-(--button-action-color) hover:bg-(--button-action-hover-color) focus-visible:bg-(--button-action-hover-color) active:bg-(--button-action-pressed-color) text-(--button-onaction-color) hover:text-(--button-onaction-hover-color) focus-visible:text-(--button-onaction-hover-color) active:text-(--button-onaction-pressed-color) transition-colors"
            onClick={toggleTheme}
            aria-label={title}
            title={title}
        >
            {icon()}
        </button>
    )
}