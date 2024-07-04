import React from 'react';
import create from 'zustand';

interface SharedState {
	example: string;
	setExample: (value: string) => void;
}

export const useStore = create<SharedState>((set) => ({
	example: 'Hello from Dojo',
	setExample: (value) => set({ example: value }),
}));

const App: React.FC = () => {
	return <div className='absolute top-0 bg-green'></div>;
};

export default App;
