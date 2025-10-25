import { render } from 'preact';

import { Home } from './pages/Home/index.jsx';
import './style.css';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { setupThemeSwitcher, Theme } from '../utils/theme-switcher.js'
import { ThemeSwitch } from './components/ThemeSwitch.js'

export function App() {
	return (
		<main>
			<Theme.Provider value={{ currentTheme: setupThemeSwitcher().currentTheme }}>
				<div class="fixed top-4 md:top-auto md:bottom-4 left-4 z-50">
					<ThemeSwitch />
				</div>
				<HashRouter>
					<Routes>
						<Route index element={<Home />} />
					</Routes>
				</HashRouter>
				{/* <Router hook={useHashLocation} hrefs={(h) => h}>
				</Router> */}
			</Theme.Provider>
		</main>
	);
}

render(<App />, document.getElementById('app'));
