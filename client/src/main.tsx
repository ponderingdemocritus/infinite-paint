import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './index.css';
import { setup } from './dojo/generated/setup';
import { DojoProvider } from './dojo/DojoContext';
import { dojoConfig } from './dojoConfig';
import { Scene } from './objects/Scene';

async function init() {
	const rootElement = document.getElementById('root');
	if (!rootElement) throw new Error('React root not found');
	const root = ReactDOM.createRoot(rootElement as HTMLElement);

	root.render(
		<div className='bg-black text-green-400 h-screen w-screen flex justify-center'>
			<div className='self-center'>Generating</div>
		</div>
	);

	const setupResult = await setup(dojoConfig);

	const graphic = new Scene(setupResult);

	graphic.initScene();

	root.render(
		<React.StrictMode>
			<DojoProvider value={setupResult}>
				<App />
			</DojoProvider>
		</React.StrictMode>
	);
}

init();
