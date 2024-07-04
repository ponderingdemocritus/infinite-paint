import { create } from 'zustand';

interface SharedState {
	example: string;
	setExample: (value: string) => void;
}

export const useStore = create<SharedState>((set) => ({
	example: 'Hello from Dojo',
	setExample: (value) => set({ example: value }),
}));
