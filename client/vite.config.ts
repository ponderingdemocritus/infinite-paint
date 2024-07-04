import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import react from '@vitejs/plugin-react';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
	plugins: [react(), wasm(), topLevelAwait()],
	build: {
		target: 'es2020',
	},
	// ... other config
});
