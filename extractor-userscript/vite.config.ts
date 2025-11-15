import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import monkey, { cdn } from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		preact(),
		monkey({
			entry: 'src/main.tsx',
			userscript: {
				icon: 'https://vitejs.dev/logo.svg',
				namespace: 'https://github.com/entrivax',
				name: 'extractor',
				match: ['https://www.patreon.com/*', 'https://onlyfans.com/*'],
			},
			build: {
				externalGlobals: {
					preact: cdn.jsdelivr('preact', 'dist/preact.min.js'),
				},
				fileName: 'extractor.user.js',
			},
		}),
	],
});
