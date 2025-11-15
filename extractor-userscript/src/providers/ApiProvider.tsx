import { createContext } from "preact"
import { Api } from "../utils/api"
import { useContext, useRef } from "preact/hooks"

const ApiContext = createContext<Api>(null)

export function ApiProvider({ children, apiUrl }: { children: preact.ComponentChildren; apiUrl: string }) {
	const api = useRef(new Api(apiUrl))

	return (
		<ApiContext.Provider value={api.current}>
			{children}
		</ApiContext.Provider>
	)
}

export function useApi() {
	const ctx = useContext(ApiContext)
	if (!ctx) {
		throw new Error("useApi must be used within an ApiProvider")
	}
	return ctx
}