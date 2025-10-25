import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		preact(),
		tailwindcss(),
		viteSingleFile(),
	],
	server: {
		proxy: {
			'/data': {
				target: 'http://localhost:5174',
        		changeOrigin: true,
				rewrite: (path) => path.replace(/^\/data/, '')
			}
		}
	}
});
