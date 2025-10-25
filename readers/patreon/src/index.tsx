import { render } from 'preact';

import { Home } from './pages/Home/index.jsx';
import { NotFound } from './pages/_404.jsx';
import './style.css';
import { HashRouter, Switch, Route } from 'react-router-dom';
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
					<Switch>
						<Route path="/" component={Home} />
						<Route component={NotFound} />
					</Switch>
				</HashRouter>
				{/* <Router hook={useHashLocation} hrefs={(h) => h}>
				</Router> */}
			</Theme.Provider>
		</main>
	);
}

render(<App />, document.getElementById('app'));
